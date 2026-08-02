import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_AUTHENTICATED_ROUTE,
  NEXT_PARAM,
  PATHNAME_HEADER,
  PUBLIC_ROUTES,
  routes,
} from "@/config/routes";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";

/**
 * Protección de rutas (convención `proxy` de Next 16, antes `middleware`).
 *
 * Sólo comprueba la PRESENCIA de la cookie de sesión: no la
 * descifra (el runtime Edge no dispone de `node:crypto`). La validación real
 * ocurre en el layout autenticado y en cada Route Handler, que sí descifran y
 * verifican expiración. Así se evita el parpadeo de contenido privado sin
 * duplicar la lógica de seguridad.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!hasSession && !isPublic) {
    const loginUrl = new URL(routes.login, request.url);
    loginUrl.searchParams.set(NEXT_PARAM, `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL(DEFAULT_AUTHENTICATED_ROUTE, request.url));
  }

  // El layout autenticado necesita la ruta actual para poder redirigir a
  // `/login?next=...` cuando la cookie existe pero ya no es válida.
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, `${pathname}${search}`);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    /*
     * Todas las rutas excepto:
     *  - /api (los Route Handlers gestionan su propia autenticación)
     *  - archivos estáticos y de Next
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
