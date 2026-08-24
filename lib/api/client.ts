import { API_PROXY_PREFIX } from "@/config/routes";

import { ApiError, networkError, normalizeApiError } from "./errors";

/**
 * Cliente HTTP del navegador.
 *
 * No habla con el backend directamente: llama al proxy de Next (`/api/proxy/...`),
 * que es quien conoce la URL real y añade la autenticación desde la cookie
 * `httpOnly`. Así el bundle no contiene ni la URL de la API ni credenciales.
 */

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  searchParams?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
}

/** Evento global emitido ante un 401: la capa de sesión lo escucha. */
export const SESSION_EXPIRED_EVENT = "agenda:session-expired";

function emitSessionExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

function buildUrl(
  path: string,
  searchParams?: QueryParams,
  prefix = API_PROXY_PREFIX,
): string {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "");
  const query = new URLSearchParams();

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === "") continue;
      query.append(key, String(value));
    }
  }

  const suffix = query.toString();
  return `${prefix}/${clean}${suffix ? `?${suffix}` : ""}`;
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: RequestOptions = {},
  prefix = API_PROXY_PREFIX,
): Promise<T> {
  const { searchParams, body, signal } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, searchParams, prefix), {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: "same-origin",
    });
  } catch (error) {
    // Una cancelación (cambio de rango, desmontaje) no es un error de red.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw networkError("NETWORK");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data =
    response.status === 204
      ? null
      : contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : await response.text().catch(() => null);

  if (!response.ok) {
    const error = normalizeApiError(response.status, data);
    if (error.isSessionExpired) emitSessionExpired();
    throw error;
  }

  return data as T;
}

export function createApiClient(prefix = API_PROXY_PREFIX) {
  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options, prefix),
    post: <T>(path: string, options?: RequestOptions) => request<T>("POST", path, options, prefix),
    patch: <T>(path: string, options?: RequestOptions) => request<T>("PATCH", path, options, prefix),
    put: <T>(path: string, options?: RequestOptions) => request<T>("PUT", path, options, prefix),
    delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options, prefix),
  };
}

export const apiClient = createApiClient();

export { ApiError };
