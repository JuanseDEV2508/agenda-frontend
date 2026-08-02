/**
 * Nombre de la cookie de sesión, aislado en su propio módulo porque lo consumen
 * tanto el servidor (Node) como el middleware (Edge), y este último no puede
 * importar `lib/auth/session.ts` (usa `node:crypto` y `next/headers`).
 */
export const SESSION_COOKIE_NAME = "agenda_session";
