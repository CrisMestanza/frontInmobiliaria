import { withApiBase } from "./api.js";

const REFRESH_URL = withApiBase("https://api.geohabita.com/api/token/refresh/");
let refreshPromise = null;

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
  const token = localStorage.getItem("access");
  const headers = new Headers(init.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(url, { ...init, headers });
  if (response.status !== 401) return response;

  const urlText = typeof url === "string" ? url : String(url?.url || "");
  if (urlText.includes("/api/token/refresh/")) return response;

  const newToken = await refreshAccessToken();
  if (!newToken) return response;

  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set("Authorization", `Bearer ${newToken}`);
  return fetch(url, { ...init, headers: retryHeaders });
}

