import { describe, expect, it } from "vitest";

import { selectHomeEvents } from "@/features/home/select";

import { BOGOTA, makeEvent } from "./factories";

/**
 * El reparto de eventos del inicio en sus cuatro bloques. Sin red ni React:
 * es la única lógica del módulo que puede equivocarse en silencio.
 */

const today = "2026-08-10";
// Mediodía en Bogotá: deja margen para probar "ya pasó" y "aún no" del mismo día.
const now = new Date("2026-08-10T12:00:00-05:00");

function select(weeks: ReturnType<typeof makeEvent>[][]) {
  return selectHomeEvents(weeks, { today, now, timezone: BOGOTA });
}

const ids = (events: ReturnType<typeof makeEvent>[]) => events.map((event) => event.id);

describe("selectHomeEvents", () => {
  it("no repite un evento que aparece en las dos semanas", () => {
    const shared = makeEvent({ id: "cruza-medianoche", startAt: "2026-08-10T00:30:00-05:00" });

    const buckets = select([[shared], [shared]]);

    expect(ids(buckets.today)).toEqual(["cruza-medianoche"]);
  });

  it("decide el día en la zona de la empresa, no en la del navegador", () => {
    // 23:30 en Bogotá es el día siguiente en UTC y en Madrid: sigue siendo hoy.
    const tardio = makeEvent({ id: "tardio", startAt: "2026-08-10T23:30:00-05:00" });

    const buckets = select([[tardio]]);

    expect(ids(buckets.today)).toEqual(["tardio"]);
    expect(buckets.upcoming).toEqual([]);
  });

  it("cuenta como atrasado lo que ya pasó y sigue abierto", () => {
    const buckets = select([
      [
        makeEvent({ id: "pendiente", status: "PENDING", startAt: "2026-08-09T10:00:00-05:00" }),
        makeEvent({ id: "confirmado", status: "CONFIRMED", startAt: "2026-08-10T09:00:00-05:00" }),
        makeEvent({ id: "completado", status: "COMPLETED", startAt: "2026-08-09T11:00:00-05:00" }),
        makeEvent({ id: "cancelado", status: "CANCELLED", startAt: "2026-08-09T12:00:00-05:00" }),
        makeEvent({ id: "no-show", status: "NO_SHOW", startAt: "2026-08-09T13:00:00-05:00" }),
      ],
    ]);

    expect(ids(buckets.overdue)).toEqual(["pendiente", "confirmado"]);
  });

  it("separa lo que hay que confirmar de lo que ya se pasó", () => {
    const buckets = select([
      [
        makeEvent({ id: "futuro", status: "PENDING", startAt: "2026-08-12T10:00:00-05:00" }),
        makeEvent({ id: "pasado", status: "PENDING", startAt: "2026-08-08T10:00:00-05:00" }),
      ],
    ]);

    expect(ids(buckets.toConfirm)).toEqual(["futuro"]);
    expect(ids(buckets.overdue)).toEqual(["pasado"]);
  });

  it("deja hoy fuera de los próximos días", () => {
    const buckets = select([
      [
        makeEvent({ id: "hoy", startAt: "2026-08-10T16:00:00-05:00" }),
        makeEvent({ id: "manana", startAt: "2026-08-11T09:00:00-05:00" }),
        makeEvent({ id: "ayer", startAt: "2026-08-09T09:00:00-05:00" }),
      ],
    ]);

    expect(ids(buckets.today)).toEqual(["hoy"]);
    expect(ids(buckets.upcoming)).toEqual(["manana"]);
  });

  it("ordena por instante real aunque los offsets difieran", () => {
    const buckets = select([
      [
        // 14:00-05:00 = 19:00 UTC; 15:00+02:00 = 13:00 UTC. El segundo va antes.
        makeEvent({ id: "tarde", startAt: "2026-08-10T14:00:00-05:00" }),
        makeEvent({ id: "temprano", startAt: "2026-08-10T15:00:00+02:00" }),
      ],
    ]);

    expect(ids(buckets.today)).toEqual(["temprano", "tarde"]);
  });
});
