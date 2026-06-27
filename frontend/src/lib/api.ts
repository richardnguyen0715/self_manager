import { ApiClientError } from "@/lib/api-error";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ─── Token storage helpers ─────────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = "mml_access_token";
const REFRESH_TOKEN_KEY = "mml_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Persist an access/refresh token pair.
 *
 * SSR-safe: the localStorage calls are guarded by `typeof window` so
 * Next.js server components / RSC rendering do not throw.
 */
export function setTokens(tokens: {
  access_token: string;
  refresh_token: string;
}): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

/**
 * Remove stored tokens (e.g. on logout or after a failed refresh).
 *
 * SSR-safe: no-ops when called during server-side rendering.
 */
export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Persisted auth-store key (zustand persist `name`). */
const AUTH_STORE_KEY = "mml_auth";

/**
 * Hard sign-out used when a 401 can't be recovered. Clears tokens AND the
 * persisted `isAuthenticated` flag, then bounces to the login page. Clearing
 * the persisted auth is essential: the AuthGuard treats a stored token OR
 * isAuthenticated as "logged in", so without this the user gets stuck on a
 * page that keeps 401-ing instead of being asked to log in again.
 */
let loggingOut = false;
function forceLogout(): void {
  if (typeof window === "undefined") return;
  clearTokens();
  localStorage.removeItem(AUTH_STORE_KEY);
  if (loggingOut) return; // avoid redirect loops from parallel 401s
  loggingOut = true;
  const here = window.location.pathname + window.location.search;
  const redirect = here.startsWith("/auth") ? "" : `?redirect=${encodeURIComponent(here)}`;
  window.location.href = `/auth?tab=login${redirect ? `&${redirect.slice(1)}` : ""}`;
}

// ─── Refresh logic ─────────────────────────────────────────────────────────────

/**
 * Shape returned by POST /api/auth/refresh.
 * Backend model: TokenPairResponse { access_token, refresh_token }
 */
interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiClientError("No refresh token available", 401);
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    forceLogout();
    throw new ApiClientError("Session expired. Please log in again.", 401);
  }

  // Backend returns flat TokenPairResponse: { access_token, refresh_token }
  const data: TokenPairResponse = await response.json();
  setTokens(data);
  return data.access_token;
}

// ─── Core fetch client ─────────────────────────────────────────────────────────

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
};

export async function apiClient<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, params, headers: extraHeaders, ...rest } = options;

  // Build URL with query params
  const url = new URL(
    path.startsWith("http") ? path : `${API_BASE_URL}${path}`,
  );
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const makeRequest = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(extraHeaders as Record<string, string>),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return fetch(url.toString(), {
      ...rest,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let accessToken = getAccessToken();
  let response = await makeRequest(accessToken);

  // Auto-refresh on 401
  if (response.status === 401) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      accessToken = await refreshPromise;
      response = await makeRequest(accessToken);
    } catch {
      // refreshAccessToken already triggered forceLogout; rethrow.
      throw new ApiClientError("Unauthorized", 401);
    }

    // A fresh token still rejected → unrecoverable; sign out and redirect.
    if (response.status === 401) {
      forceLogout();
      throw new ApiClientError("Session expired. Please log in again.", 401);
    }
  }

  if (!response.ok) {
    let errorBody: {
      message?: string;
      code?: string;
      details?: Record<string, string[]>;
    } = {};
    try {
      errorBody = await response.json();
    } catch {
      // ignore JSON parse errors on error responses
    }
    throw new ApiClientError(
      errorBody.message ?? `Request failed with status ${response.status}`,
      response.status,
      errorBody.code,
      errorBody.details,
    );
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── Convenience wrappers ──────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, params?: RequestOptions["params"]) =>
    apiClient<T>(path, { method: "GET", params }),

  post: <T>(path: string, body?: unknown) =>
    apiClient<T>(path, { method: "POST", body }),

  put: <T>(path: string, body?: unknown) =>
    apiClient<T>(path, { method: "PUT", body }),

  patch: <T>(path: string, body?: unknown) =>
    apiClient<T>(path, { method: "PATCH", body }),

  delete: <T>(path: string) => apiClient<T>(path, { method: "DELETE" }),
};
