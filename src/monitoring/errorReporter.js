const TELEGRAM_API_BASE = "https://api.telegram.org";
const DEFAULT_ERROR_REPORT_URL = "https://api.geohabita.com/api/frontend-error-report/";
const SENSITIVE_KEY_PATTERN = /pass|password|token|secret|authorization|cookie|session|key|jwt/i;
const MAX_FIELD_LENGTH = 700;
const MAX_MESSAGE_LENGTH = 3500;
const recentReports = new Map();

function truncate(value, max = MAX_FIELD_LENGTH) {
  if (typeof value !== "string") return value;
  return value.length > max ? `${value.slice(0, max)}... [truncated]` : value;
}

function maskSensitiveValue(key, value) {
  if (!SENSITIVE_KEY_PATTERN.test(String(key || ""))) return value;
  if (typeof value !== "string" || value.length <= 8) return "[redacted]";
  return `${value.slice(0, 4)}...${value.slice(-4)} [redacted]`;
}

function sanitizeValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 3) return "[max-depth]";

  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof FormData !== "undefined" && value instanceof FormData) {
    const entries = {};
    for (const [key, entryValue] of value.entries()) {
      entries[key] = sanitizeValue(maskSensitiveValue(key, entryValue), depth + 1);
    }
    return entries;
  }

  if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) {
    return sanitizeValue(Object.fromEntries(value.entries()), depth + 1);
  }

  if (typeof Headers !== "undefined" && value instanceof Headers) {
    return sanitizeValue(Object.fromEntries(value.entries()), depth + 1);
  }

  if (typeof value === "object") {
    const result = {};
    for (const [key, entryValue] of Object.entries(value)) {
      result[key] = sanitizeValue(maskSensitiveValue(key, entryValue), depth + 1);
    }
    return result;
  }

  return truncate(String(value));
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function serializeBody(body) {
  if (body == null) return null;

  if (typeof body === "string") {
    const parsed = tryParseJson(body);
    return sanitizeValue(parsed ?? body);
  }

  return sanitizeValue(body);
}

function serializeError(error) {
  if (!error) return null;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: truncate(error.stack || ""),
    };
  }

  return sanitizeValue(error);
}

function getActiveRoute() {
  if (typeof window === "undefined") return "unknown";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function buildSignature(payload) {
  return JSON.stringify([
    payload.kind,
    payload.message,
    payload.route,
    payload.request?.url,
    payload.response?.status,
  ]);
}

function shouldSkipDuplicate(signature) {
  const now = Date.now();
  const lastSent = recentReports.get(signature);
  recentReports.set(signature, now);

  for (const [key, timestamp] of recentReports.entries()) {
    if (now - timestamp > 60_000) {
      recentReports.delete(key);
    }
  }

  return lastSent && now - lastSent < 30_000;
}

function formatTelegramMessage(payload) {
  const lines = [
    "🚨 ERROR EN GEOHABITA",
    `Tipo: ${payload.kind || "unknown"}`,
    `Vista: ${payload.route || getActiveRoute()}`,
    `Hora: ${new Date().toLocaleString("es-PE")}`,
  ];

  if (payload.message) lines.push(`Mensaje: ${truncate(payload.message, 500)}`);
  if (payload.request?.method) lines.push(`Metodo: ${payload.request.method}`);
  if (payload.request?.url) lines.push(`URL/Endpoint: ${truncate(payload.request.url, 500)}`);
  if (payload.response?.status) lines.push(`Status: ${payload.response.status}`);
  if (payload.userAction) lines.push(`Accion: ${truncate(payload.userAction, 500)}`);

  const requestDetails = sanitizeValue({
    query: payload.request?.query,
    params: payload.request?.params,
    headers: payload.request?.headers,
    body: payload.request?.body,
  });

  if (requestDetails && JSON.stringify(requestDetails) !== "{}") {
    lines.push(`Datos enviados: ${truncate(JSON.stringify(requestDetails), 900)}`);
  }

  if (payload.extra) {
    lines.push(`Contexto: ${truncate(JSON.stringify(sanitizeValue(payload.extra)), 900)}`);
  }

  const serializedError = serializeError(payload.error);
  if (serializedError?.message) lines.push(`Error: ${truncate(serializedError.message, 700)}`);
  if (serializedError?.stack) lines.push(`Stack: ${truncate(serializedError.stack, 1200)}`);

  const finalMessage = lines.join("\n");
  return finalMessage.length > MAX_MESSAGE_LENGTH
    ? `${finalMessage.slice(0, MAX_MESSAGE_LENGTH)}... [truncated]`
    : finalMessage;
}

async function postJson(url, payload) {
  const fetchImpl =
    typeof window !== "undefined" && window.__nativeFetchForTelemetry
      ? window.__nativeFetchForTelemetry
      : fetch;

  await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

async function sendViaRelay(message, payload) {
  const relayUrl = import.meta.env.VITE_ERROR_REPORT_URL || DEFAULT_ERROR_REPORT_URL;
  if (!relayUrl) return false;

  await postJson(relayUrl, {
    message,
    source: "frontend",
    payload: sanitizeValue(payload),
  });
  return true;
}

async function sendDirectToTelegram(message) {
  const enabled = import.meta.env.VITE_ENABLE_DIRECT_TELEGRAM === "true";
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;

  if (!enabled || !botToken || !chatId) return false;

  await postJson(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    chat_id: chatId,
    text: message,
  });
  return true;
}

export async function reportError(payload) {
  try {
    const normalizedPayload = {
      route: getActiveRoute(),
      ...payload,
      request: payload?.request
        ? {
            ...payload.request,
            headers: sanitizeValue(payload.request.headers),
            body: serializeBody(payload.request.body),
          }
        : undefined,
    };

    const signature = buildSignature(normalizedPayload);
    if (shouldSkipDuplicate(signature)) return;

    const message = formatTelegramMessage(normalizedPayload);
    const sent = await sendViaRelay(message, normalizedPayload);
    if (!sent) {
      await sendDirectToTelegram(message);
    }
  } catch (reportingError) {
    console.error("No se pudo reportar el error a Telegram", reportingError);
  }
}

export function createHttpErrorPayload({
  url,
  method,
  status,
  requestBody,
  requestHeaders,
  error,
  responseBody,
  userAction,
}) {
  return {
    kind: "http",
    message: error?.message || `HTTP ${status || "request failed"}`,
    error,
    userAction,
    request: {
      method,
      url,
      headers: requestHeaders,
      body: requestBody,
    },
    response: {
      status,
      body: sanitizeValue(responseBody),
    },
  };
}

export function createRuntimeErrorPayload({ error, kind = "runtime", extra, userAction }) {
  return {
    kind,
    message: error?.message || "Unhandled frontend error",
    error,
    extra,
    userAction,
  };
}
