import { NextResponse } from "next/server";

import { buildExpiredSessionCookie } from "@/lib/auth/session";

/**
 * Cierre de sesión.
 *
 * El backend no documenta un endpoint de logout (Basic Auth no mantiene estado
 * en el servidor), así que cerrar sesión consiste en eliminar la cookie. El
 * cliente además limpia la caché de TanStack Query para que no queden datos del
 * usuario anterior.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(buildExpiredSessionCookie());
  return response;
}
