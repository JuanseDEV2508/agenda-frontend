import { describe, expect, it } from "vitest";

import {
  addMinutesToTime,
  calendarDateOf,
  durationInMinutes,
  formatDuration,
  formatEventDate,
  formatEventTime,
  formatEventTimeRange,
  getVisibleRange,
  isValidCalendarDate,
  minutesOfDay,
  monthsCoveringRange,
  shiftAnchor,
  splitApiDateTime,
  toApiDateTime,
} from "@/lib/dates";

/**
 * El entorno de pruebas corre en Europe/Madrid (ver tests/setup.ts) mientras la
 * inmobiliaria opera en America/Bogota: cualquier conversión que use la hora del
 * dispositivo en lugar de la de la empresa falla aquí.
 */
const BOGOTA = "America/Bogota";

describe("formato de fechas en la zona de la empresa", () => {
  it("muestra la hora de la empresa, no la del dispositivo", () => {
    // 8:00 a. m. en Bogotá son las 15:00 en Madrid.
    expect(formatEventTime("2026-08-10T08:00:00-05:00", BOGOTA)).toBe("8:00 a. m.");
  });

  it("no convierte un evento de la mañana en uno de la madrugada", () => {
    const time = formatEventTime("2026-08-10T08:00:00-05:00", BOGOTA);
    expect(time).not.toBe("3:00 a. m.");
  });

  it("usa el formato en español pedido", () => {
    expect(formatEventDate("2026-08-01T10:00:00-05:00", BOGOTA)).toBe(
      "sábado, 1 de agosto de 2026",
    );
    expect(formatEventTime("2026-08-01T15:30:00-05:00", BOGOTA)).toBe("3:30 p. m.");
  });

  it("formatea un rango horario", () => {
    expect(
      formatEventTimeRange("2026-08-01T08:30:00-05:00", "2026-08-01T09:30:00-05:00", BOGOTA),
    ).toBe("8:30 a. m. – 9:30 a. m.");
  });

  it("devuelve un guion cuando no hay fecha", () => {
    expect(formatEventTime(null, BOGOTA)).toBe("—");
    expect(formatEventDate(undefined, BOGOTA)).toBe("—");
  });

  it("calcula el día de calendario según la zona de la empresa", () => {
    // 23:30 en Bogotá es el día siguiente en Madrid; debe seguir siendo el 10.
    expect(calendarDateOf("2026-08-10T23:30:00-05:00", BOGOTA)).toBe("2026-08-10");
  });

  it("calcula los minutos desde medianoche en la zona de la empresa", () => {
    expect(minutesOfDay("2026-08-10T08:00:00-05:00", BOGOTA)).toBe(480);
  });
});

describe("conversión hacia la API", () => {
  it("genera ISO-8601 con el offset de la empresa", () => {
    expect(toApiDateTime("2026-08-10", "15:00", BOGOTA)).toBe("2026-08-10T15:00:00-05:00");
  });

  it("es reversible", () => {
    const iso = toApiDateTime("2026-08-10", "15:00", BOGOTA);
    expect(splitApiDateTime(iso, BOGOTA)).toEqual({ date: "2026-08-10", time: "15:00" });
  });

  it("rechaza fechas u horas inválidas", () => {
    expect(toApiDateTime("no-es-fecha", "15:00", BOGOTA)).toBeNull();
    expect(toApiDateTime("2026-08-10", "25:00", BOGOTA)).toBeNull();
  });
});

describe("duraciones", () => {
  it("calcula minutos entre dos instantes", () => {
    expect(
      durationInMinutes("2026-08-10T15:00:00-05:00", "2026-08-10T16:30:00-05:00"),
    ).toBe(90);
  });

  it("formatea la duración en español", () => {
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(null)).toBe("—");
  });

  it("suma minutos a una hora y detecta el cambio de día", () => {
    expect(addMinutesToTime("23:30", 60)).toEqual({ time: "00:30", dayOffset: 1 });
    expect(addMinutesToTime("09:00", 90)).toEqual({ time: "10:30", dayOffset: 0 });
  });
});

describe("rango visible", () => {
  it("la vista diaria cubre un solo día", () => {
    const range = getVisibleRange("day", "2026-08-10");
    expect(range.days).toEqual(["2026-08-10"]);
    expect(range.label).toBe("Lunes, 10 de agosto de 2026");
  });

  it("la vista semanal empieza en lunes y cubre siete días", () => {
    const range = getVisibleRange("week", "2026-08-12");
    expect(range.days).toHaveLength(7);
    expect(range.start).toBe("2026-08-10");
    expect(range.end).toBe("2026-08-16");
  });

  it("la rejilla mensual completa semanas enteras", () => {
    const range = getVisibleRange("month", "2026-08-15");
    expect(range.days.length % 7).toBe(0);
    expect(range.days).toContain("2026-08-01");
    expect(range.days).toContain("2026-08-31");
    expect(range.label).toBe("Agosto de 2026");
  });

  it("indica los meses que hay que consultar para la rejilla", () => {
    const range = getVisibleRange("month", "2026-08-15");
    const months = monthsCoveringRange(range);
    expect(months).toContainEqual({ year: 2026, month: 8 });
    // Agosto de 2026 empieza en sábado: la rejilla arrastra días de julio.
    expect(months).toContainEqual({ year: 2026, month: 7 });
  });
});

describe("navegación", () => {
  it("avanza y retrocede según la vista", () => {
    expect(shiftAnchor("day", "2026-08-10", 1)).toBe("2026-08-11");
    expect(shiftAnchor("week", "2026-08-10", -1)).toBe("2026-08-03");
    expect(shiftAnchor("month", "2026-08-10", 1)).toBe("2026-09-10");
  });

  it("valida fechas de calendario", () => {
    expect(isValidCalendarDate("2026-08-10")).toBe(true);
    expect(isValidCalendarDate("2026-13-10")).toBe(false);
    expect(isValidCalendarDate("10/08/2026")).toBe(false);
    expect(isValidCalendarDate(null)).toBe(false);
  });
});
