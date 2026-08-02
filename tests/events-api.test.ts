import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelEvent,
  confirmEvent,
  createEvent,
  fetchCalendarMonth,
  fetchCalendarWeek,
  markNoShow,
  reassignEvent,
  rescheduleEvent,
  updateEvent,
} from "@/features/agenda/api/events.api";
import { ApiError } from "@/lib/api/errors";

/**
 * Pruebas de contrato de la capa de API: verifican que se llaman exactamente
 * las rutas documentadas, con los parámetros y payloads documentados.
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

const eventPayload = {
  id: "event-1",
  status: "PENDING",
  event_type: "PROPERTY_VISIT",
  title: "Visita apartamento",
  start_at: "2026-08-10T15:00:00-05:00",
  end_at: "2026-08-10T16:00:00-05:00",
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

describe("consultas de calendario", () => {
  it("consulta la semana con start_date", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [eventPayload] }));

    const events = await fetchCalendarWeek("2026-08-10");

    expect(lastCall().url).toBe("/api/proxy/calendar/week?start_date=2026-08-10");
    expect(events).toHaveLength(1);
  });

  it("consulta el mes con year y month", async () => {
    fetchMock.mockResolvedValue(jsonResponse([eventPayload]));

    await fetchCalendarMonth({ year: 2026, month: 8 });

    expect(lastCall().url).toBe("/api/proxy/calendar/month?year=2026&month=8");
  });
});

describe("creación de eventos", () => {
  it("envía POST /events/ con el payload documentado", async () => {
    fetchMock.mockResolvedValue(jsonResponse(eventPayload, 201));

    const created = await createEvent({
      advisor: "advisor-1",
      client: "client-1",
      event_type: "PROPERTY_VISIT",
      title: "Visita apartamento",
      start_at: "2026-08-10T15:00:00-05:00",
      end_at: "2026-08-10T16:00:00-05:00",
      timezone: "America/Bogota",
    });

    const { url, init, body } = lastCall();
    expect(url).toBe("/api/proxy/events");
    expect(init.method).toBe("POST");
    expect(body.advisor).toBe("advisor-1");
    expect(body).not.toHaveProperty("company_id");
    expect(created.id).toBe("event-1");
  });

  it("propaga el conflicto de horario sin simular éxito", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: "EVENT_CONFLICT", message: "El asesor no está disponible" } },
        400,
      ),
    );

    const promise = createEvent({
      advisor: "advisor-1",
      event_type: "PROPERTY_VISIT",
      title: "Visita",
      start_at: "2026-08-10T15:00:00-05:00",
      end_at: "2026-08-10T16:00:00-05:00",
      timezone: "America/Bogota",
    });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      code: "EVENT_CONFLICT",
      status: 400,
    });
  });

  it("propaga un 403 de permisos", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "No autorizado." }, 403));

    await expect(
      createEvent({
        advisor: "advisor-9",
        event_type: "OTHER",
        title: "X",
        start_at: "2026-08-10T15:00:00-05:00",
        end_at: "2026-08-10T16:00:00-05:00",
        timezone: "America/Bogota",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("edición y acciones", () => {
  it("edita con PATCH y sólo los campos enviados", async () => {
    fetchMock.mockResolvedValue(jsonResponse(eventPayload));

    await updateEvent("event-1", { title: "Nuevo título" });

    const { url, init, body } = lastCall();
    expect(url).toBe("/api/proxy/events/event-1");
    expect(init.method).toBe("PATCH");
    expect(body).toEqual({ title: "Nuevo título" });
  });

  it("confirma con POST a /confirm/", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...eventPayload, status: "CONFIRMED" }));

    const event = await confirmEvent("event-1");

    expect(lastCall().url).toBe("/api/proxy/events/event-1/confirm");
    expect(event.status).toBe("CONFIRMED");
  });

  it("cancela con el payload documentado {reason, cancellation_source}", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...eventPayload, status: "CANCELLED" }));

    await cancelEvent("event-1", {
      reason: "El cliente no puede asistir",
      cancellationSource: "CLIENT",
    });

    const { url, body } = lastCall();
    expect(url).toBe("/api/proxy/events/event-1/cancel");
    expect(body).toEqual({
      reason: "El cliente no puede asistir",
      cancellation_source: "CLIENT",
    });
  });

  it("marca inasistencia con el tipo indicado", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...eventPayload, status: "NO_SHOW" }));

    await markNoShow("event-1", { noShowType: "CLIENT_NO_SHOW" });

    const { url, body } = lastCall();
    expect(url).toBe("/api/proxy/events/event-1/no-show");
    expect(body).toEqual({ no_show_type: "CLIENT_NO_SHOW" });
  });

  it("reprograma con start_at y end_at y devuelve el nuevo evento", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...eventPayload, id: "event-2", start_at: "2026-08-11T15:00:00-05:00" }, 201),
    );

    const nuevo = await rescheduleEvent("event-1", {
      startAt: "2026-08-11T15:00:00-05:00",
      endAt: "2026-08-11T16:00:00-05:00",
    });

    const { url, body } = lastCall();
    expect(url).toBe("/api/proxy/events/event-1/reschedule");
    expect(body).toEqual({
      start_at: "2026-08-11T15:00:00-05:00",
      end_at: "2026-08-11T16:00:00-05:00",
    });
    expect(nuevo.id).toBe("event-2");
  });

  it("incluye el asesor en la reprogramación sólo si se cambia", async () => {
    fetchMock.mockResolvedValue(jsonResponse(eventPayload));

    await rescheduleEvent("event-1", {
      startAt: "2026-08-11T15:00:00-05:00",
      endAt: "2026-08-11T16:00:00-05:00",
      advisorId: "advisor-2",
    });

    expect(lastCall().body.advisor).toBe("advisor-2");
  });

  it("reasigna enviando el campo advisor", async () => {
    fetchMock.mockResolvedValue(jsonResponse(eventPayload));

    await reassignEvent("event-1", "advisor-2");

    const { url, body } = lastCall();
    expect(url).toBe("/api/proxy/events/event-1/reassign");
    expect(body).toEqual({ advisor: "advisor-2" });
  });
});

describe("respuestas inesperadas", () => {
  it("falla de forma explícita si el backend no devuelve un evento válido", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ mensaje: "ok" }));

    await expect(confirmEvent("event-1")).rejects.toThrow(/formato esperado de evento/);
  });

  it("convierte un fallo de red en un error legible", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(confirmEvent("event-1")).rejects.toMatchObject({
      message: expect.stringContaining("No fue posible conectar"),
    });
  });
});
