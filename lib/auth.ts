export const credentials = { username: "admin.darajat", password: "admin123" };
export const sessionKey = "green-hero-admin-session";

export function hasSession() {
  return typeof window !== "undefined" && (
    localStorage.getItem(sessionKey) === "active" ||
    sessionStorage.getItem(sessionKey) === "active"
  );
}

export function saveSession(remember: boolean) {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
  (remember ? localStorage : sessionStorage).setItem(sessionKey, "active");
}

export function clearSession() {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
}
