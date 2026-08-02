import { describe, expect, it } from "vitest";

import { API_ERROR_KIND, getErrorMessage, normalizeApiError } from "@/lib/api/errors";

describe("normalización de errores del backend", () => {
  it("interpreta el formato de negocio {error: {code, message}}", () => {
    const error = normalizeApiError(400, {
      error: { code: "EVENT_CONFLICT", message: "El asesor no está disponible" },
    });

    expect(error.code).toBe("EVENT_CONFLICT");
    expect(error.isScheduleConflict).toBe(true);
    expect(error.message).toContain("ya tiene un evento programado");
  });

  it("interpreta {detail}", () => {
    const error = normalizeApiError(403, { detail: "No tienes permiso." });
    expect(error.kind).toBe(API_ERROR_KIND.FORBIDDEN);
    expect(error.message).toBe("No tienes permiso.");
    expect(error.isForbidden).toBe(true);
  });

  it("interpreta errores por campo", () => {
    const error = normalizeApiError(400, {
      title: ["Este campo es obligatorio."],
      start_at: ["Fecha inválida."],
    });

    expect(error.kind).toBe(API_ERROR_KIND.VALIDATION);
    expect(error.fieldErrors.title).toEqual(["Este campo es obligatorio."]);
    expect(error.fieldErrors.start_at).toEqual(["Fecha inválida."]);
    expect(error.hasFieldErrors).toBe(true);
  });

  it("interpreta non_field_errors", () => {
    const error = normalizeApiError(400, {
      non_field_errors: ["El rango horario es inválido."],
    });
    expect(error.message).toBe("El rango horario es inválido.");
  });

  it("marca 401 como sesión expirada", () => {
    const error = normalizeApiError(401, null);
    expect(error.isSessionExpired).toBe(true);
    expect(error.message).toBe("Tu sesión expiró. Inicia sesión nuevamente.");
  });

  it("no revela detalles en un 404", () => {
    const error = normalizeApiError(404, null);
    expect(error.isNotFound).toBe(true);
    expect(error.message).toContain("no está dentro de tu alcance");
  });

  it("trata 409 como conflicto de agenda", () => {
    expect(normalizeApiError(409, null).isScheduleConflict).toBe(true);
  });

  it("nunca muestra mensajes técnicos ni HTML", () => {
    const fromHtml = normalizeApiError(500, "<html><body>Server Error</body></html>");
    expect(fromHtml.message).not.toContain("<html>");
    expect(fromHtml.message).toContain("error en el servidor");

    expect(getErrorMessage(new Error("Request failed with status code 400"))).toBe(
      "Request failed with status code 400",
    );
    expect(getErrorMessage(normalizeApiError(500, null))).not.toContain("status code");
  });

  it("da un mensaje legible ante errores desconocidos", () => {
    expect(getErrorMessage(undefined)).toBe("Ocurrió un error inesperado.");
  });
});
