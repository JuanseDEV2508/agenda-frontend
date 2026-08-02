import "server-only";

/**
 * Único punto donde se decide **cómo** se autentica el servidor contra el backend.
 *
 * Hoy: Basic Auth (lo único documentado en frontend_endpoints.md).
 * Mañana: si el backend expone JWT o sesión Django + CSRF, basta con cambiar
 * `buildAuthHeaders` y el login en `app/api/auth/login/route.ts`.
 */
export function buildAuthHeaders(basicAuth: string): Record<string, string> {
  return { Authorization: `Basic ${basicAuth}` };
}
