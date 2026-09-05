export const routes = {
  login: "/login",
  home: "/",
  agenda: "/agenda",
  followUps: "/seguimientos",
  metrics: "/metricas",
  eventDetail: (id: string) => `/agenda/eventos/${id}`,
  profile: "/perfil",
} as const;

/** Rutas del BFF de autenticación (Route Handlers de Next, no del backend). */
export const authRoutes = {
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  session: "/api/auth/session",
} as const;

/** Prefijo del proxy servidor→backend. */
export const API_PROXY_PREFIX = "/api/proxy";

/** Endpoints públicos del BFF exclusivos para las métricas del dashboard. */
export const API_DASHBOARD_PREFIX = "/api/dashboard";

/** Rutas accesibles sin sesión. */
export const PUBLIC_ROUTES: readonly string[] = [routes.login];

export const DEFAULT_AUTHENTICATED_ROUTE = routes.home;

/** Parámetro usado para volver a la ruta solicitada tras iniciar sesión. */
export const NEXT_PARAM = "next";

/** Cabecera interna que el middleware usa para pasar la ruta actual al layout. */
export const PATHNAME_HEADER = "x-agenda-pathname";

/**
 * Solo se permiten redirecciones internas: evita open redirect a través de
 * `?next=https://sitio-externo`.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_AUTHENTICATED_ROUTE;
  if (!value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }
  if (value.startsWith(routes.login)) return DEFAULT_AUTHENTICATED_ROUTE;
  return value;
}
