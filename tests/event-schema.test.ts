import { describe, expect, it } from "vitest";

import {
  buildCreateDefaults,
  buildEditDefaults,
  diffEventPayload,
  eventFormSchema,
  showsClientFields,
  showsPropertyFields,
  toEventPayload,
} from "@/features/agenda/schemas/event.schema";

import { BOGOTA, makeEvent } from "./factories";

function baseValues(overrides: Record<string, unknown> = {}) {
  return {
    advisorId: "advisor-1",
    clientId: "client-1",
    eventType: "PROPERTY_VISIT",
    title: "Visita apartamento",
    description: "",
    startDate: "2026-08-10",
    startTime: "15:00",
    endDate: "2026-08-10",
    endTime: "16:00",
    location: "",
    meetingUrl: "",
    propertyExternalId: "",
    propertyCode: "APT-902",
    propertyTitle: "",
    propertyAddress: "",
    propertyUrl: "",
    requiresConfirmation: false,
    ...overrides,
  };
}

describe("validación del formulario", () => {
  it("acepta un evento válido", () => {
    expect(eventFormSchema.safeParse(baseValues()).success).toBe(true);
  });

  it("exige el título", () => {
    const result = eventFormSchema.safeParse(baseValues({ title: "   " }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "title")).toBe(true);
  });

  it("exige el asesor", () => {
    const result = eventFormSchema.safeParse(baseValues({ advisorId: "" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "advisorId")).toBe(true);
  });

  it("rechaza una finalización anterior o igual al inicio", () => {
    const antes = eventFormSchema.safeParse(baseValues({ endTime: "14:00" }));
    expect(antes.success).toBe(false);
    expect(antes.error?.issues.some((issue) => issue.path[0] === "endTime")).toBe(true);

    const igual = eventFormSchema.safeParse(baseValues({ endTime: "15:00" }));
    expect(igual.success).toBe(false);
  });

  it("acepta un evento que cruza la medianoche", () => {
    const result = eventFormSchema.safeParse(
      baseValues({ startTime: "23:00", endDate: "2026-08-11", endTime: "01:00" }),
    );
    expect(result.success).toBe(true);
  });

  it("rechaza URLs inválidas o con esquemas peligrosos", () => {
    expect(eventFormSchema.safeParse(baseValues({ meetingUrl: "no-es-url" })).success).toBe(
      false,
    );
    expect(
      eventFormSchema.safeParse(baseValues({ meetingUrl: "javascript:alert(1)" })).success,
    ).toBe(false);
    expect(
      eventFormSchema.safeParse(baseValues({ meetingUrl: "https://meet.example.com/x" }))
        .success,
    ).toBe(true);
  });
});

describe("campos condicionales por tipo de evento", () => {
  it("la visita a inmueble muestra cliente e inmueble", () => {
    expect(showsClientFields("PROPERTY_VISIT")).toBe(true);
    expect(showsPropertyFields("PROPERTY_VISIT")).toBe(true);
  });

  it("los tipos personales ocultan cliente e inmueble", () => {
    for (const type of ["PERSONAL_BLOCK", "LUNCH", "VACATION"] as const) {
      expect(showsClientFields(type)).toBe(false);
      expect(showsPropertyFields(type)).toBe(false);
    }
  });

  it("la reunión interna no requiere cliente", () => {
    expect(showsClientFields("INTERNAL_MEETING")).toBe(false);
  });
});

describe("mapeo al payload del backend", () => {
  it("usa los nombres de campo documentados y la zona de la empresa", () => {
    const values = eventFormSchema.parse(baseValues());
    const payload = toEventPayload(values, BOGOTA);

    expect(payload).toMatchObject({
      advisor: "advisor-1",
      client: "client-1",
      event_type: "PROPERTY_VISIT",
      title: "Visita apartamento",
      start_at: "2026-08-10T15:00:00-05:00",
      end_at: "2026-08-10T16:00:00-05:00",
      timezone: BOGOTA,
      property_code: "APT-902",
    });
  });

  it("nunca envía company_id ni campos de auditoría", () => {
    const payload = toEventPayload(eventFormSchema.parse(baseValues()), BOGOTA);
    expect(payload).not.toHaveProperty("company_id");
    expect(payload).not.toHaveProperty("created_by_id");
    expect(payload).not.toHaveProperty("updated_by_id");
  });

  it("omite cliente e inmueble cuando el tipo no los usa", () => {
    const values = eventFormSchema.parse(
      baseValues({ eventType: "PERSONAL_BLOCK", clientId: "client-1", propertyCode: "APT-902" }),
    );
    const payload = toEventPayload(values, BOGOTA);

    expect(payload).not.toHaveProperty("client");
    expect(payload).not.toHaveProperty("property_code");
  });

  it("no envía campos opcionales vacíos", () => {
    const payload = toEventPayload(eventFormSchema.parse(baseValues()), BOGOTA);
    expect(payload).not.toHaveProperty("description");
    expect(payload).not.toHaveProperty("meeting_url");
    expect(payload).not.toHaveProperty("requires_confirmation");
  });
});

describe("edición", () => {
  it("precarga los valores del evento en la zona de la empresa", () => {
    const defaults = buildEditDefaults(makeEvent(), BOGOTA);
    expect(defaults.startDate).toBe("2026-08-10");
    expect(defaults.startTime).toBe("15:00");
    expect(defaults.endTime).toBe("16:00");
    expect(defaults.advisorId).toBe("advisor-1");
    expect(defaults.clientId).toBe("client-1");
  });

  it("sólo envía los campos modificados", () => {
    const original = toEventPayload(eventFormSchema.parse(baseValues()), BOGOTA);
    const next = toEventPayload(
      eventFormSchema.parse(baseValues({ title: "Visita reagendada" })),
      BOGOTA,
    );

    const patch = diffEventPayload(original, next);
    expect(patch).toEqual({ title: "Visita reagendada" });
  });

  it("un formulario sin cambios produce un patch vacío", () => {
    const payload = toEventPayload(eventFormSchema.parse(baseValues()), BOGOTA);
    expect(diffEventPayload(payload, payload)).toEqual({});
  });
});

describe("valores iniciales al crear", () => {
  it("aplica la duración por defecto sobre la hora seleccionada", () => {
    const defaults = buildCreateDefaults({
      timezone: BOGOTA,
      advisorId: "advisor-1",
      date: "2026-08-10",
      time: "09:00",
      durationMinutes: 45,
    });

    expect(defaults.startTime).toBe("09:00");
    expect(defaults.endTime).toBe("09:45");
    expect(defaults.endDate).toBe("2026-08-10");
    expect(defaults.advisorId).toBe("advisor-1");
  });

  it("desplaza la fecha de fin si la duración cruza la medianoche", () => {
    const defaults = buildCreateDefaults({
      timezone: BOGOTA,
      date: "2026-08-10",
      time: "23:30",
      durationMinutes: 60,
    });

    expect(defaults.endTime).toBe("00:30");
    expect(defaults.endDate).toBe("2026-08-11");
  });
});
