import { apiRequest, clearAccessToken, setAccessToken } from "./api/client";

export type AuthUser = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  roleName: string;
  photoUrl: string | null;
  permissions: string[];
};

type AuthSession = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  sessionExpiresAt: string;
  user: AuthUser;
};

let currentUser: AuthUser | null = null;
let sessionExpiresAt = 0;
let restorePromise: Promise<boolean> | null = null;
let sessionVersion = 0;

function applySession(session: AuthSession): void {
  sessionVersion += 1;
  setAccessToken(session.accessToken);
  currentUser = session.user;
  sessionExpiresAt = Date.parse(session.sessionExpiresAt);
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

export function getSessionRemainingMs(): number {
  return Math.max(0, sessionExpiresAt - Date.now());
}

export function hasSession(): boolean {
  return Boolean(currentUser) && getSessionRemainingMs() > 0;
}

export async function login(identifier: string, password: string): Promise<AuthUser> {
  const session = await apiRequest<AuthSession>("auth/login", {
    method: "POST",
    auth: false,
    body: { identifier: identifier.trim(), password },
  });
  applySession(session);
  return session.user;
}

export async function restoreSession(): Promise<boolean> {
  if (hasSession()) return true;
  if (!restorePromise) {
    const version = sessionVersion;
    restorePromise = (async () => {
      try {
        const session = await apiRequest<AuthSession>("auth/refresh", {
          method: "POST",
          auth: false,
        });
        if (version === sessionVersion) applySession(session);
        return hasSession();
      } catch {
        if (version === sessionVersion) clearLocalSession();
        return hasSession();
      } finally {
        restorePromise = null;
      }
    })();
  }
  return restorePromise;
}

function clearLocalSession(): void {
  sessionVersion += 1;
  clearAccessToken();
  currentUser = null;
  sessionExpiresAt = 0;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>("auth/logout", { method: "POST", auth: false });
  } finally {
    clearLocalSession();
  }
}
