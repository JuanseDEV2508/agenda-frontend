import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  decideFollowUp,
  fetchFollowUps,
  sendFollowUp,
} from "@/features/follow-ups/api/follow-ups.api";

/**
 * Contrato de la capa de API del seguimiento de leads: rutas, parámetros y
 * payloads exactos documentados en `agenda-backend/docs/follow_ups.md`.
 */

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const lead = {
  phone: "+573001112233",
  name: "Laura Gómez",
  reason: "CANCELLED",
  since: "2026-08-01T15:00:00-05:00",
  client_id: "client-1",
  contact_id: null,
  advisor: { id: "advisor-1", full_name: "Ana Torres" },
  source_event_id: "event-1",
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

describe("cola de seguimiento", () => {
  it("desenvuelve la clave `results`", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [lead], count: 1 }));

    await expect(fetchFollowUps()).resolves.toEqual([lead]);
    expect(lastCall().url).toBe("/api/proxy/follow-ups");
  });

  it("devuelve una lista vacía si el backend no envía la clave", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await expect(fetchFollowUps()).resolves.toEqual([]);
  });

  it("propaga los filtros de asesor y motivo", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));

    await fetchFollowUps({ advisor: "advisor-1", reason: "NO_SHOW" });

    expect(lastCall().url).toBe("/api/proxy/follow-ups?advisor=advisor-1&reason=NO_SHOW");
  });
});

describe("decisiones", () => {
  it("manda el teléfono en el cuerpo, nunca en la ruta", async () => {
    // El proxy valida cada segmento contra `^[A-Za-z0-9_-]+$`: un `+` en la
    // URL fallaría antes de llegar al backend.
    fetchMock.mockResolvedValue(jsonResponse(lead));

    await decideFollowUp({ phone: "+573001112233", status: "DISMISSED", notes: "Compró en otra parte" });

    const call = lastCall();
    expect(call.url).toBe("/api/proxy/follow-ups/decide");
    expect(call.init.method).toBe("POST");
    expect(call.body).toEqual({
      phone: "+573001112233",
      status: "DISMISSED",
      notes: "Compró en otra parte",
    });
  });

  it("incluye la fecha al posponer y omite los campos vacíos", async () => {
    fetchMock.mockResolvedValue(jsonResponse(lead));

    await decideFollowUp({ phone: "+573001112233", status: "SNOOZED", dueAt: "2026-09-15T09:00:00.000Z" });

    expect(lastCall().body).toEqual({
      phone: "+573001112233",
      status: "SNOOZED",
      due_at: "2026-09-15T09:00:00.000Z",
    });
  });

  it("envía el seguimiento de un lead", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ phone: "+573001112233", message_status: "sent" }));

    const result = await sendFollowUp("+573001112233");

    expect(lastCall().url).toBe("/api/proxy/follow-ups/send");
    expect(lastCall().body).toEqual({ phone: "+573001112233" });
    expect(result.message_status).toBe("sent");
  });
});
