const FIELD_LABELS = {
  nombreproyecto: "Nombre del proyecto",
  descripcion: "Descripcion",
  latitud: "Latitud",
  longitud: "Longitud",
  puntos: "Poligono",
  imagenes: "Imagenes",
  precio: "Precio",
  moneda: "Moneda",
  correo: "Correo",
  email: "Correo",
  password: "Contrasena",
  non_field_errors: "Error general",
  detail: "Detalle",
  message: "Mensaje",
  error: "Error",
  financing_config: "Financiamiento",
  nombreinmobiliaria: "Nombre de la inmobiliaria",
  telefono: "Telefono",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  tiktok: "TikTok",
  pagina: "Pagina web",
};

const STATUS_MESSAGES = {
  400: "Revisa los datos ingresados. Hay informacion invalida o incompleta.",
  401: "Tu sesion expiro. Inicia sesion nuevamente.",
  403: "No tienes permisos para realizar esta accion.",
  404: "No se encontro el recurso solicitado.",
  409: "La informacion entra en conflicto con un registro existente.",
  413: "El archivo enviado es demasiado grande.",
  415: "El formato del archivo no es compatible.",
  422: "No se pudo procesar la informacion enviada.",
  429: "Demasiados intentos. Espera un momento y vuelve a intentar.",
  500: "El servidor tuvo un problema. Intenta nuevamente en unos minutos.",
  502: "El servidor no respondio correctamente. Intenta nuevamente.",
  503: "El servicio no esta disponible temporalmente.",
  504: "El servidor tardo demasiado en responder.",
};

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const cleanText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const labelForField = (key) => FIELD_LABELS[key] || key.replace(/_/g, " ");

function flattenBackendError(value, parentKey = "") {
  if (value == null || value === "") return [];

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = cleanText(value);
    return text ? [parentKey ? `${labelForField(parentKey)}: ${text}` : text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenBackendError(item, parentKey));
  }

  if (isPlainObject(value)) {
    const priorityKeys = ["detail", "message", "error", "non_field_errors"];
    const priorityMessages = priorityKeys.flatMap((key) =>
      Object.prototype.hasOwnProperty.call(value, key)
        ? flattenBackendError(value[key], key === "non_field_errors" ? "" : key)
        : [],
    );

    const fieldMessages = Object.entries(value)
      .filter(([key]) => !priorityKeys.includes(key))
      .flatMap(([key, item]) => flattenBackendError(item, key));

    return [...priorityMessages, ...fieldMessages];
  }

  return [];
}

export function parseBackendError(body, fallback = "No se pudo completar la solicitud.") {
  const messages = flattenBackendError(body)
    .map(cleanText)
    .filter(Boolean);

  if (!messages.length) return fallback;

  return [...new Set(messages)].slice(0, 6).join(" ");
}

export async function getResponseErrorMessage(response, fallback) {
  const statusFallback =
    fallback ||
    STATUS_MESSAGES[response?.status] ||
    `No se pudo completar la solicitud. Codigo ${response?.status || "desconocido"}.`;

  if (!response) return statusFallback;

  try {
    const contentType = response.headers?.get?.("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.clone().json();
      return parseBackendError(data, statusFallback);
    }

    const text = cleanText(await response.clone().text());
    return text || statusFallback;
  } catch {
    return statusFallback;
  }
}

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function throwResponseError(response, fallback) {
  const message = await getResponseErrorMessage(response, fallback);
  throw new ApiError(message, { status: response?.status });
}
