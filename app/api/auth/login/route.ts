import { NextResponse, type NextRequest } from "next/server";

import { checkServerEnv } from "@/config/env";
import { loginSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/errors";
import { resolveSessionUser } from "@/lib/auth/resolve-session-user";
import {
  buildSessionCookie,
  computeExpiresAt,
  encodeBasicAuth,
  type SessionPayload,
} from "@/lib/auth/session";

/**
 * Inicio de sesión (BFF).
 *
 * El backend documentado no expone `POST /auth/login/`: la validación de
 * credenciales se hace llamando a un endpoint real y protegido
 * (`GET /companies/current/`) con Basic Auth. Si responde 200, las credenciales
 * son válidas; si responde 401, no lo son.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const envCheck = checkServerEnv();
  if (!envCheck.ok) {
    console.error("[auth/login] Configuración inválida:", envCheck.message);
    return NextResponse.json(
      { detail: "El servidor no está configurado correctamente. Contacta al administrador." },
      { status: 500 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { detail: "Revisa los datos ingresados.", ...z2FieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const { email, password, rememberMe } = parsed.data;
  const basicAuth = encodeBasicAuth(email, password);

  try {
    const session = await resolveSessionUser(basicAuth, email);

    const payload: SessionPayload = {
      basicAuth,
      user: session.user,
      company: session.company,
      expiresAt: computeExpiresAt(rememberMe),
    };

    const response = NextResponse.json(session, { status: 200 });
    response.cookies.set(buildSessionCookie(payload, rememberMe));
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        // Mensaje deliberadamente genérico: no revela si el correo existe.
        return NextResponse.json(
          { detail: "Correo o contraseña incorrectos." },
          { status: 401 },
        );
      }

      // Nunca se registra la credencial, sólo el código de estado.
      console.error(`[auth/login] Error del backend (${error.status})`);
      return NextResponse.json({ detail: error.message }, { status: error.status || 502 });
    }

    console.error("[auth/login] Error inesperado al iniciar sesión.");
    return NextResponse.json(
      { detail: "No fue posible iniciar sesión. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}

/** Convierte los errores de Zod al formato por campo que ya entiende el cliente. */
function z2FieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "non_field_errors");
    fields[key] = [...(fields[key] ?? []), issue.message];
  }
  return fields;
}
