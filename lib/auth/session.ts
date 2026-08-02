import "server-only";

import { cookies } from "next/headers";

import { serverEnv } from "@/config/env";
import type { AuthenticatedUser, CompanySummary, Session } from "@/features/auth/types";

import { decryptJson, encryptJson } from "./crypto";
import { SESSION_COOKIE_NAME } from "./session-cookie-name";

/**
 * Sesión del usuario: cookie `httpOnly` cifrada.
 *
 * ⚠️ Nota de arquitectura (ver docs/frontend-api-analysis.md §2): el backend sólo
 * expone Basic Auth, por lo que la credencial debe reenviarse en cada petición y
 * vive cifrada dentro de la cookie. No se expone nunca al navegador. Cuando el
 * backend ofrezca JWT o sesión Django + CSRF, este archivo y
 * `lib/auth/backend-auth.ts` son los dos únicos puntos a cambiar.
 */

export { SESSION_COOKIE_NAME };

/** "Recordarme": 7 días. Sin recordarme: cookie de sesión de navegador. */
const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  /** Credencial Basic ya codificada. Nunca sale del servidor. */
  basicAuth: string;
  user: AuthenticatedUser;
  company: CompanySummary;
  /** Marca de tiempo (ms) de expiración; `null` = dura lo que el navegador. */
  expiresAt: number | null;
}

export function encodeBasicAuth(email: string, password: string): string {
  return Buffer.from(`${email}:${password}`, "utf8").toString("base64");
}

export function serializeSession(payload: SessionPayload): string {
  return encryptJson(payload);
}

function isExpired(payload: SessionPayload): boolean {
  return payload.expiresAt !== null && Date.now() > payload.expiresAt;
}

/** Lee y valida la sesión de la petición actual. */
export async function getSessionPayload(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const payload = decryptJson<SessionPayload>(raw);
  if (!payload?.basicAuth || !payload.user || !payload.company) return null;
  if (isExpired(payload)) return null;

  return payload;
}

/** Datos públicos de la sesión (sin credenciales) para enviar al cliente. */
export function toPublicSession(payload: SessionPayload): Session {
  return { user: payload.user, company: payload.company };
}

export async function getSession(): Promise<Session | null> {
  const payload = await getSessionPayload();
  return payload ? toPublicSession(payload) : null;
}

export function buildSessionCookie(payload: SessionPayload, rememberMe: boolean) {
  return {
    name: SESSION_COOKIE_NAME,
    value: serializeSession(payload),
    httpOnly: true,
    secure: serverEnv.isProduction,
    sameSite: "lax" as const,
    path: "/",
    ...(rememberMe ? { maxAge: REMEMBER_ME_MAX_AGE_SECONDS } : {}),
  };
}

/**
 * Reescribe la cookie conservando su expiración original.
 *
 * Se usa al refrescar la sesión: actualizar los datos del usuario no debe
 * prolongar indefinidamente la duración de la sesión.
 */
export function buildRefreshedSessionCookie(payload: SessionPayload) {
  const base = {
    name: SESSION_COOKIE_NAME,
    value: serializeSession(payload),
    httpOnly: true,
    secure: serverEnv.isProduction,
    sameSite: "lax" as const,
    path: "/",
  };

  if (payload.expiresAt === null) return base;

  const remainingSeconds = Math.max(0, Math.floor((payload.expiresAt - Date.now()) / 1000));
  return { ...base, maxAge: remainingSeconds };
}

export function buildExpiredSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: serverEnv.isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function computeExpiresAt(rememberMe: boolean): number | null {
  return rememberMe ? Date.now() + REMEMBER_ME_MAX_AGE_SECONDS * 1000 : null;
}
