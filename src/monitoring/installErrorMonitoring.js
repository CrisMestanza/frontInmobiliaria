import axios from "axios";
import {
  createHttpErrorPayload,
  createRuntimeErrorPayload,
  reportError,
} from "./errorReporter.js";

let installed = false;

function normalizeUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input || "");
}

function normalizeMethod(input, init) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return (input.method || "GET").toUpperCase();
  }
  return "GET";
}

async function parseResponseBody(response) {
  try {
    const clone = response.clone();
    const contentType = clone.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await clone.json();
    }
    return await clone.text();
  } catch {
    return null;
  }
}

function shouldReportStatus(status) {
  return status >= 500 || status === 0 || status === 429 || status === 422;
}

function installFetchInterceptor() {
  const originalFetch = window.fetch.bind(window);
  window.__nativeFetchForTelemetry = originalFetch;

  window.fetch = async (input, init = {}) => {
    const method = normalizeMethod(input, init);
    const url = normalizeUrl(input);
    const userAction = init?.telegramContext?.action;
    const skipMonitoring = init?.skipErrorMonitoring === true;

    try {
      const response = await originalFetch(input, init);
      if (!skipMonitoring && shouldReportStatus(response.status)) {
        const responseBody = await parseResponseBody(response);
        void reportError(
          createHttpErrorPayload({
            url,
            method,
            status: response.status,
            requestBody: init?.body,
            requestHeaders: init?.headers,
            responseBody,
            userAction,
            error: new Error(`HTTP ${response.status} en ${url}`),
          }),
        );
      }
      return response;
    } catch (error) {
      if (error?.name === "AbortError") throw error;

      if (!skipMonitoring) {
        void reportError(
          createHttpErrorPayload({
            url,
            method,
            status: 0,
            requestBody: init?.body,
            requestHeaders: init?.headers,
            userAction,
            error,
          }),
        );
      }
      throw error;
    }
  };
}

function installAxiosInterceptor() {
  axios.interceptors.response.use(
    (response) => {
      if (shouldReportStatus(response.status)) {
        void reportError(
          createHttpErrorPayload({
            url: response.config?.url,
            method: response.config?.method?.toUpperCase(),
            status: response.status,
            requestBody: response.config?.data,
            requestHeaders: response.config?.headers,
            responseBody: response.data,
            userAction: response.config?.telegramContext?.action,
            error: new Error(`HTTP ${response.status} en ${response.config?.url}`),
          }),
        );
      }
      return response;
    },
    (error) => {
      const status = error?.response?.status || 0;
      if (error?.code !== "ERR_CANCELED") {
        void reportError(
          createHttpErrorPayload({
            url: error?.config?.url,
            method: error?.config?.method?.toUpperCase(),
            status,
            requestBody: error?.config?.data,
            requestHeaders: error?.config?.headers,
            responseBody: error?.response?.data,
            userAction: error?.config?.telegramContext?.action,
            error,
          }),
        );
      }
      return Promise.reject(error);
    },
  );
}

function installRuntimeHandlers() {
  window.addEventListener("error", (event) => {
    void reportError(
      createRuntimeErrorPayload({
        kind: "window-error",
        error: event.error || new Error(event.message || "Window error"),
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      }),
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason =
      event.reason instanceof Error
        ? event.reason
        : new Error(typeof event.reason === "string" ? event.reason : "Unhandled promise rejection");

    void reportError(
      createRuntimeErrorPayload({
        kind: "unhandled-rejection",
        error: reason,
        extra: {
          reason: event.reason,
        },
      }),
    );
  });
}

export function installErrorMonitoring() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  installFetchInterceptor();
  installAxiosInterceptor();
  installRuntimeHandlers();
}
