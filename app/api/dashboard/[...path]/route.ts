import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { backendRequest } from "@/lib/api/server-client";
import { getSessionPayload } from "@/lib/auth/session";

/** Endpoints del dashboard sin el segmento `/proxy` en la URL pública. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_RESOURCES = new Set([
  "overview",
  "events",
  "advisors",
  "messages",
  "conversations",
  "funnel",
]);

const SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json(
      { detail: "Tu sesión expiró. Inicia sesión nuevamente." },
      { status: 401 },
    );
  }

  const { path } = await context.params;
  if (!path?.length || !ALLOWED_RESOURCES.has(path[0]) || !path.every((segment) => SEGMENT_PATTERN.test(segment))) {
    return NextResponse.json({ detail: "Recurso no disponible." }, { status: 404 });
  }

  try {
    const { status, data } = await backendRequest<unknown>({
      path: `dashboard/${path.join("/")}`,
      searchParams: request.nextUrl.searchParams,
      basicAuth: session.basicAuth,
      signal: request.signal,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        error.payload ?? { detail: error.message },
        { status: error.status || 502 },
      );
    }

    return NextResponse.json(
      { detail: "No fue posible conectar con el servidor." },
      { status: 502 },
    );
  }
}
