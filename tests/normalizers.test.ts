import { describe, expect, it } from "vitest";

import {
  extractResults,
  normalizeAdvisor,
  normalizeClient,
  normalizeEvent,
  normalizeEventList,
} from "@/features/agenda/api/normalizers";

describe("extracción de listados", () => {
  it("acepta paginación DRF", () => {
    expect(extractResults({ count: 1, next: null, previous: null, results: [1, 2] })).toEqual([
      1, 2,
    ]);
  });

  it("acepta un array plano", () => {
    expect(extractResults([1, 2])).toEqual([1, 2]);
  });

  it("acepta la respuesta agrupada por fecha que puede devolver /calendar/", () => {
    const grouped = {
      "2026-08-10": [{ id: "a" }],
      "2026-08-11": [{ id: "b" }],
    };
    expect(extractResults(grouped)).toHaveLength(2);
  });

  it("no inventa datos ante una respuesta desconocida", () => {
    expect(extractResults("texto")).toEqual([]);
    expect(extractResults(null)).toEqual([]);
  });
});

describe("normalización de eventos", () => {
  it("lee el evento con las claves documentadas", () => {
    const event = normalizeEvent({
      id: "uuid-1",
      status: "PENDING",
      event_type: "PROPERTY_VISIT",
      title: "Visita apartamento",
      start_at: "2026-08-10T15:00:00-05:00",
      end_at: "2026-08-10T16:00:00-05:00",
      timezone: "America/Bogota",
      advisor: { id: "advisor-1", name: "Carlos Pérez" },
      client: { id: "client-1", first_name: "Laura", last_name: "Gómez" },
      property_external_id: "PROP-123",
      assigned_automatically: true,
    });

    expect(event).not.toBeNull();
    expect(event?.advisor).toEqual({ id: "advisor-1", name: "Carlos Pérez" });
    expect(event?.client?.name).toBe("Laura Gómez");
    expect(event?.propertyExternalId).toBe("PROP-123");
    expect(event?.assignedAutomatically).toBe(true);
  });

  it("acepta relaciones enviadas como UUID suelto", () => {
    const event = normalizeEvent({
      id: "uuid-1",
      start_at: "2026-08-10T15:00:00-05:00",
      advisor: "advisor-1",
      client: "client-1",
    });

    expect(event?.advisor?.id).toBe("advisor-1");
    expect(event?.client?.id).toBe("client-1");
  });

  it("toma el nombre de los campos hermanos que devuelve EventList", () => {
    // El serializador de listado envía el UUID en `advisor` y el nombre aparte.
    const event = normalizeEvent({
      id: "uuid-1",
      start_at: "2026-08-10T15:00:00-05:00",
      advisor: "advisor-1",
      advisor_name: "Carlos Pérez",
      client: "client-1",
      client_name: "Laura Gómez",
    });

    expect(event?.advisor).toEqual({ id: "advisor-1", name: "Carlos Pérez" });
    expect(event?.client?.name).toBe("Laura Gómez");
  });

  it("descarta valores de enum que no conoce en lugar de romper", () => {
    const event = normalizeEvent({
      id: "uuid-1",
      start_at: "2026-08-10T15:00:00-05:00",
      status: "UN_ESTADO_NUEVO",
      event_type: "OTRO_TIPO",
    });

    expect(event?.status).toBeNull();
    expect(event?.eventType).toBeNull();
  });

  it("descarta registros sin id o sin fecha de inicio", () => {
    expect(normalizeEvent({ title: "sin id" })).toBeNull();
    expect(normalizeEvent({ id: "uuid-1" })).toBeNull();
    expect(normalizeEventList([{ id: "uuid-1" }, null, "texto"])).toEqual([]);
  });
});

describe("normalización de asesores y clientes", () => {
  it("compone el nombre desde el usuario anidado", () => {
    const advisor = normalizeAdvisor({
      id: "advisor-1",
      user: { id: "user-1", first_name: "Ana", last_name: "Ríos", email: "ana@x.co", role: "ADVISOR" },
      code: "A-01",
    });

    expect(advisor?.name).toBe("Ana Ríos");
    expect(advisor?.email).toBe("ana@x.co");
    expect(advisor?.code).toBe("A-01");
    expect(advisor?.role).toBe("ADVISOR");
  });

  it("usa el teléfono normalizado del cliente cuando existe", () => {
    const client = normalizeClient({
      id: "client-1",
      first_name: "Laura",
      last_name: "Gómez",
      normalized_phone: "+573001234567",
    });

    expect(client?.name).toBe("Laura Gómez");
    expect(client?.phone).toBe("+573001234567");
  });
});
