import "server-only";

import { serverEnv } from "@/config/env";
import { buildAuthHeaders } from "@/lib/auth/backend-auth";

import { ApiError, networkError, normalizeApiError } from "./errors";

/**
 * Cliente HTTP servidor → backend. Es el ÚNICO lugar del proyecto donde se
 * conoce la URL real de la API y donde se añade la cabecera de autenticación.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

export interface BackendRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Ruta relativa a la base, sin barra inicial. Ej.: `events/123/confirm`. */
  path: string;
  searchParams?: Record<string, string | number | undefined | null> | URLSearchParams;
  body?: unknown;
  basicAuth?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface BackendResponse<T> {
  status: number;
  data: T;
}

/** Django exige barra final; se normaliza aquí y no en cada llamada. */
function buildUrl(
  path: string,
  searchParams?: BackendRequestOptions["searchParams"],
): string {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "");
  const url = new URL(`${serverEnv.apiBaseUrl}/${clean}/`);

  if (searchParams instanceof URLSearchParams) {
    searchParams.forEach((value, key) => url.searchParams.append(key, value));
  } else if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.append(key, String(value));
    }
  }

  return url.toString();
}

async function readBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status === 204) return null;

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

export async function backendRequest<T = unknown>(
  options: BackendRequestOptions,
): Promise<BackendResponse<T>> {
  const {
    method = "GET",
    path,
    searchParams,
    body,
    basicAuth,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (basicAuth) Object.assign(headers, buildAuthHeaders(basicAuth));
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(buildUrl(path, searchParams), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
      // El backend es multiempresa y la respuesta depende de la identidad:
      // nunca se cachea en el servidor de Next.
    });
  } catch (error) {
    clearTimeout(timeout);
    const aborted = error instanceof Error && error.name === "AbortError";
    throw networkError(aborted ? "TIMEOUT" : "NETWORK");
  } finally {
    clearTimeout(timeout);
  }

  const data = await readBody(response);

  if (!response.ok) {
    throw normalizeApiError(response.status, data);
  }

  return { status: response.status, data: data as T };
}

/** Variante que devuelve `null` en lugar de lanzar para los códigos indicados. */
export async function backendRequestTolerant<T>(
  options: BackendRequestOptions,
  tolerateStatuses: number[],
): Promise<T | null> {
  try {
    const { data } = await backendRequest<T>(options);
    return data;
  } catch (error) {
    if (error instanceof ApiError && tolerateStatuses.includes(error.status)) {
      return null;
    }
    throw error;
  }
}
