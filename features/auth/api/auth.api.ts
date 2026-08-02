import { authRoutes } from "@/config/routes";
import type { Session } from "@/features/auth/types";
import { networkError, normalizeApiError } from "@/lib/api/errors";

/**
 * Llamadas al BFF de autenticación (Route Handlers de Next).
 * No usan `apiClient` porque no pasan por el proxy hacia el backend.
 */

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw networkError("NETWORK");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) throw normalizeApiError(response.status, data);
  return data as T;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe: boolean;
}

export function login(payload: LoginPayload): Promise<Session> {
  return postJson<Session>(authRoutes.login, payload);
}

export function logout(): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(authRoutes.logout);
}

/**
 * Vuelve a resolver la sesión en el servidor con la credencial ya guardada.
 * Permite que una sesión abierta antes de un cambio en el backend recupere sus
 * capacidades sin obligar al usuario a volver a entrar.
 */
export function refreshSession(): Promise<Session> {
  return postJson<Session>(authRoutes.session);
}

export async function fetchSession(signal?: AbortSignal): Promise<Session | null> {
  const response = await fetch(authRoutes.session, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
  });

  if (response.status === 401) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw normalizeApiError(response.status, data);
  return data as Session;
}
