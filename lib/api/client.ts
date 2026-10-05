const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

type ApiErrorPayload = {
  error?: { code?: string; message?: string };
  message?: string;
};

type RefreshResponse = { accessToken: string };

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

function getApiBaseUrl(): string {
  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL belum dikonfigurasi.");
  }
  return apiBaseUrl;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const raw = await response.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const payload = data as ApiErrorPayload | null;
    throw new ApiError(
      payload?.error?.message ?? payload?.message ?? response.statusText ?? "Request gagal.",
      response.status,
      payload?.error?.code,
    );
  }

  return data as T;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          clearAccessToken();
          return null;
        }
        const session = await readResponse<RefreshResponse>(response);
        setAccessToken(session.accessToken);
        return session.accessToken;
      } catch {
        clearAccessToken();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true, body, headers: suppliedHeaders, ...requestOptions } = options;
  const headers = new Headers(suppliedHeaders);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestBody =
    body === undefined ? undefined : isFormData ? body : JSON.stringify(body);
  const url = `${getApiBaseUrl()}/${path.replace(/^\/+/, "")}`;

  async function send(token: string | null): Promise<Response> {
    const requestHeaders = new Headers(headers);
    if (auth && token) requestHeaders.set("Authorization", `Bearer ${token}`);
    return fetch(url, {
      ...requestOptions,
      body: requestBody,
      headers: requestHeaders,
      credentials: "include",
      cache: "no-store",
    });
  }

  let response = await send(accessToken);
  if (auth && response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) response = await send(refreshedToken);
  }

  return readResponse<T>(response);
}
