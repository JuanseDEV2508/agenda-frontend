import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { backendRequest } from "@/lib/api/server-client";
import { getSessionPayload } from "@/lib/auth/session";

/**
 * Proxy servidor → backend.
 *
 * El navegador nunca llama a la API real: llama aquí, y este handler añade la
 * autenticación leída de la cookie `httpOnly`. Ventajas: la credencial no está
 * en el bundle ni en `localStorage`, y la URL del backend no se expone.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sólo se permiten los recursos que este módulo necesita (principio de mínimo
 * privilegio): el proxy no es una pasarela abierta a toda la API.
 */
const ALLOWED_RESOURCES = new Set([
  "events",
  "calendar",
  "advisors",
  "clients",
  "advisor-availabilities",
  "scheduling-configurations",
  "companies",
  "inbox",
]);

const SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

type RouteContext = { params: Promise<{ path: string[] }> };

function unauthorized() {
  return NextResponse.json(
    { detail: "Tu sesión expiró. Inicia sesión nuevamente." },
    { status: 401 },
  );
}

async function handle(
  request: NextRequest,
  context: RouteContext,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
) {
  const session = await getSessionPayload();
  if (!session) return unauthorized();

  const { path } = await context.params;

  if (!path?.length || !ALLOWED_RESOURCES.has(path[0])) {
    return NextResponse.json({ detail: "Recurso no disponible." }, { status: 404 });
  }

  if (!path.every((segment) => SEGMENT_PATTERN.test(segment))) {
    return NextResponse.json({ detail: "Ruta inválida." }, { status: 400 });
  }

  let body: unknown;
  if (method !== "GET") {
    body = await request.json().catch(() => undefined);
  }

  try {
    const { status, data } = await backendRequest<unknown>({
      method,
      path: path.join("/"),
      searchParams: request.nextUrl.searchParams,
      body,
      basicAuth: session.basicAuth,
      signal: request.signal,
    });

    if (data === null || status === 204) {
      return new NextResponse(null, { status });
    }

    return NextResponse.json(data, { status });
  } catch (error) {
    if (error instanceof ApiError) {
      // Se reenvía el cuerpo original del backend para que el cliente pueda
      // mapear errores por campo. Nunca se convierte un fallo en éxito.
      const payload =
        error.payload !== undefined && error.payload !== null
          ? error.payload
          : { detail: error.message };
      return NextResponse.json(payload, { status: error.status || 502 });
    }

    return NextResponse.json(
      { detail: "No fue posible conectar con el servidor." },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handle(request, context, "GET");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handle(request, context, "POST");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handle(request, context, "PATCH");
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handle(request, context, "PUT");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handle(request, context, "DELETE");
}
