import { describe, expect, it } from "vitest";

import { applyFilters } from "@/features/agenda/hooks/use-calendar-events";
import { EMPTY_AGENDA_FILTERS } from "@/features/agenda/types";
import {
  groupEventsByDay,
  hasConflict,
  layoutDayEvents,
} from "@/features/agenda/utils/layout";

import { BOGOTA, makeEvent } from "./factories";

describe("agrupación por día", () => {
  it("agrupa según la zona horaria de la empresa", () => {
    const events = [
      makeEvent({ id: "a", startAt: "2026-08-10T23:30:00-05:00", endAt: "2026-08-10T23:59:00-05:00" }),
      makeEvent({ id: "b", startAt: "2026-08-11T08:00:00-05:00", endAt: "2026-08-11T09:00:00-05:00" }),
    ];

    const grouped = groupEventsByDay(events, BOGOTA);
    // 23:30 en Bogotá ya es día 11 en Madrid: debe seguir contando como día 10.
    expect(grouped.get("2026-08-10")?.map((event) => event.id)).toEqual(["a"]);
    expect(grouped.get("2026-08-11")?.map((event) => event.id)).toEqual(["b"]);
  });

  it("repite en cada día los eventos que abarcan varias jornadas", () => {
    const vacaciones = makeEvent({
      id: "vac",
      eventType: "VACATION",
      startAt: "2026-08-10T00:00:00-05:00",
      endAt: "2026-08-12T23:59:00-05:00",
    });

    const grouped = groupEventsByDay([vacaciones], BOGOTA);
    expect([...grouped.keys()].sort()).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
  });

  it("no entra en bucle si el fin es anterior al inicio", () => {
    const incoherente = makeEvent({
      startAt: "2026-08-10T10:00:00-05:00",
      endAt: "2026-08-09T10:00:00-05:00",
    });

    const grouped = groupEventsByDay([incoherente], BOGOTA);
    expect(grouped.size).toBe(1);
  });
});

describe("posicionamiento y solapes", () => {
  it("coloca el evento según la hora de la empresa", () => {
    const [item] = layoutDayEvents(
      [makeEvent({ startAt: "2026-08-10T08:00:00-05:00", endAt: "2026-08-10T09:00:00-05:00" })],
      "2026-08-10",
      BOGOTA,
    );

    expect(item.startMinutes).toBe(480); // 08:00
    expect(item.endMinutes).toBe(540); // 09:00
    expect(item.columns).toBe(1);
  });

  it("reparte en columnas los eventos solapados sin ocultar ninguno", () => {
    const events = [
      makeEvent({ id: "a", startAt: "2026-08-10T09:00:00-05:00", endAt: "2026-08-10T10:00:00-05:00" }),
      makeEvent({ id: "b", startAt: "2026-08-10T09:30:00-05:00", endAt: "2026-08-10T10:30:00-05:00" }),
      makeEvent({ id: "c", startAt: "2026-08-10T09:45:00-05:00", endAt: "2026-08-10T10:15:00-05:00" }),
    ];

    const items = layoutDayEvents(events, "2026-08-10", BOGOTA);

    expect(items).toHaveLength(3);
    expect(items.every((item) => item.columns === 3)).toBe(true);
    expect(new Set(items.map((item) => item.column)).size).toBe(3);
    expect(items.every(hasConflict)).toBe(true);
  });

  it("no marca conflicto en eventos consecutivos", () => {
    const events = [
      makeEvent({ id: "a", startAt: "2026-08-10T09:00:00-05:00", endAt: "2026-08-10T10:00:00-05:00" }),
      makeEvent({ id: "b", startAt: "2026-08-10T10:00:00-05:00", endAt: "2026-08-10T11:00:00-05:00" }),
    ];

    const items = layoutDayEvents(events, "2026-08-10", BOGOTA);
    expect(items.every((item) => item.columns === 1)).toBe(true);
    expect(items.some(hasConflict)).toBe(false);
  });

  it("recorta a la jornada los eventos que vienen del día anterior", () => {
    const largo = makeEvent({
      startAt: "2026-08-09T22:00:00-05:00",
      endAt: "2026-08-10T02:00:00-05:00",
    });

    const [item] = layoutDayEvents([largo], "2026-08-10", BOGOTA);
    expect(item.startMinutes).toBe(0);
    expect(item.endMinutes).toBe(120);
    expect(item.continuesFromPreviousDay).toBe(true);
  });

  it("garantiza una altura mínima legible para eventos sin duración", () => {
    const [item] = layoutDayEvents(
      [makeEvent({ startAt: "2026-08-10T09:00:00-05:00", endAt: "2026-08-10T09:00:00-05:00" })],
      "2026-08-10",
      BOGOTA,
    );

    expect(item.endMinutes).toBeGreaterThan(item.startMinutes);
  });
});

describe("filtros sobre el rango visible", () => {
  const events = [
    makeEvent({ id: "a", status: "PENDING", eventType: "PROPERTY_VISIT" }),
    makeEvent({
      id: "b",
      status: "CONFIRMED",
      eventType: "PHONE_CALL",
      advisor: { id: "advisor-2", name: "Ana Ríos" },
      client: { id: "c2", name: "Pedro Ruiz" },
      title: "Llamada de seguimiento",
    }),
  ];

  it("sin filtros devuelve todo", () => {
    expect(applyFilters(events, EMPTY_AGENDA_FILTERS)).toHaveLength(2);
  });

  it("filtra por asesor", () => {
    const result = applyFilters(events, { ...EMPTY_AGENDA_FILTERS, advisorId: "advisor-2" });
    expect(result.map((event) => event.id)).toEqual(["b"]);
  });

  it("filtra por estado y por tipo", () => {
    expect(
      applyFilters(events, { ...EMPTY_AGENDA_FILTERS, status: "PENDING" }).map((e) => e.id),
    ).toEqual(["a"]);
    expect(
      applyFilters(events, { ...EMPTY_AGENDA_FILTERS, eventType: "PHONE_CALL" }).map((e) => e.id),
    ).toEqual(["b"]);
  });

  it("busca por título, cliente o asesor sin distinguir mayúsculas", () => {
    expect(
      applyFilters(events, { ...EMPTY_AGENDA_FILTERS, search: "pedro" }).map((e) => e.id),
    ).toEqual(["b"]);
    expect(
      applyFilters(events, { ...EMPTY_AGENDA_FILTERS, search: "SEGUIMIENTO" }).map((e) => e.id),
    ).toEqual(["b"]);
  });

  it("devuelve vacío cuando ningún evento coincide", () => {
    expect(applyFilters(events, { ...EMPTY_AGENDA_FILTERS, search: "inexistente" })).toEqual([]);
  });
});
