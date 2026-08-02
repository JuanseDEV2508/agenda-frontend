import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { resolveSessionUser } from "@/lib/auth/resolve-session-user";
import {
  buildExpiredSessionCookie,
  buildRefreshedSessionCookie,
  getSession,
  getSessionPayload,
  type SessionPayload,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sesión actual (sin credenciales). Se usa para revalidar en el cliente. */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ detail: "No hay sesión activa." }, { status: 401 });
  }

  return NextResponse.json(session, { status: 200 });
}

/**
 * Vuelve a resolver identidad, rol y capacidades con la credencial ya guardada,
 * y reescribe la cookie conservando su expiración.
 *
 * Sirve para que una sesión abierta antes de un cambio en el backend (por
 * ejemplo, la publicación de `GET /users/me/permissions/`) se repare sola, sin
 * obligar al usuario a cerrar sesión.
 */
export async function POST() {
  const payload = await getSessionPayload();

  if (!payload) {
    return NextResponse.json({ detail: "No hay sesión activa." }, { status: 401 });
  }

  try {
    const session = await resolveSessionUser(payload.basicAuth, payload.user.email);

    const refreshed: SessionPayload = {
      ...payload,
      user: session.user,
      company: session.company,
    };

    const response = NextResponse.json(session, { status: 200 });
    response.cookies.set(buildRefreshedSessionCookie(refreshed));
    return response;
  } catch (error) {
    // La credencial dejó de ser válida: se cierra la sesión.
    if (error instanceof ApiError && error.status === 401) {
      const response = NextResponse.json(
        { detail: "Tu sesión expiró. Inicia sesión nuevamente." },
        { status: 401 },
      );
      response.cookies.set(buildExpiredSessionCookie());
      return response;
    }

    // Cualquier otro fallo deja la sesión intacta: se sigue usando la anterior.
    return NextResponse.json(
      { detail: "No fue posible actualizar la sesión." },
      { status: 502 },
    );
  }
}
