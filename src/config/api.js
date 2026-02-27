// export const API_BASE_URL = "https://api.geohabita.com";
// Para localhost usa sin "/" al final para evitar URLs con doble slash.
export const API_BASE_URL = "http://127.0.0.1:8000";

export const withApiBase = (url = "") =>
  typeof url === "string"
    ? url.replace("https://api.geohabita.com", API_BASE_URL.replace(/\/+$/, ""))
    : url;
