export function formatLocalDateForApi(date = new Date()) {
  return date.toISOString().split("T")[0];
}

export function formatLocalTimeForApi(date = new Date()) {
  return date.toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
