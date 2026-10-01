export const credentials = { username: "admin.darajat", password: "admin123" };
export const sessionKey = "green-hero-admin-session";
export const sessionDurationMs = 15 * 60 * 1000;

function getStoredSession() {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" &&
      typeof (value as { expiresAt?: unknown }).expiresAt === "number") {
      return value as { expiresAt: number };
    }
  } catch {
    // Previous demo sessions without an expiry are no longer valid.
  }
  clearSession();
  return null;
}

export function getSessionRemainingMs() {
  const session = getStoredSession();
  if (!session) return 0;
  const remaining = session.expiresAt - Date.now();
  if (remaining <= 0) {
    clearSession();
    return 0;
  }
  return remaining;
}

export function hasSession() {
  return getSessionRemainingMs() > 0;
}

export function saveSession(remember: boolean) {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
  (remember ? localStorage : sessionStorage).setItem(
    sessionKey,
    JSON.stringify({ expiresAt: Date.now() + sessionDurationMs }),
  );
}

export function clearSession() {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
}
