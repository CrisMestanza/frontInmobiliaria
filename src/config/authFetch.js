import { withApiBase } from "./api.js";

const REFRESH_URL = withApiBase("https://api.geohabita.com/api/token/refresh/");
const ACCESS_REFRESH_WINDOW_SECONDS = 90;
let refreshPromise = null;

function parseJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function shouldRefreshAccessToken(accessToken) {
  if (!accessToken) return false;
  const payload = parseJwtPayload(accessToken);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= ACCESS_REFRESH_WINDOW_SECONDS;
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refresh = localStorage.getItem("refresh");
  if (!refresh) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch(REFRESH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (!data?.access) return null;

      localStorage.setItem("access", data.access);
      if (data.refresh) {
        localStorage.setItem("refresh", data.refresh);
      }
      return data.access;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function authFetch(input, init = {}) {
  const url = typeof input === "string" ? withApiBase(input) : input;
  const urlText = typeof url === "string" ? url : String(url?.url || "");
  const isRefreshRequest = urlText.includes("/api/token/refresh/");
  let token = localStorage.getItem("access");

  // Proactive refresh: renew a bit before expiration to avoid mid-flow 401s.
  if (!isRefreshRequest && shouldRefreshAccessToken(token)) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      token = refreshedToken;
    }
  }

  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(url, { ...init, headers });
  if (response.status !== 401) return response;

  if (isRefreshRequest) return response;

  const newToken = await refreshAccessToken();
  if (!newToken) return response;

  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set("Authorization", `Bearer ${newToken}`);
  return fetch(url, { ...init, headers: retryHeaders });
}
