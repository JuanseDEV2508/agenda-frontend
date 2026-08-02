/**
 * Normalización de errores de la API.
 *
 * Formatos contemplados (ver docs/frontend-api-analysis.md §6):
 *   {"error": {"code": "EVENT_CONFLICT", "message": "..."}}
 *   {"detail": "..."}
 *   {"campo": ["mensaje"]}
 *   {"non_field_errors": ["mensaje"]}
 */

export type FieldErrors = Record<string, string[]>;

export const API_ERROR_KIND = {
  NETWORK: "NETWORK",
  TIMEOUT: "TIMEOUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
  SERVER: "SERVER",
  UNKNOWN: "UNKNOWN",
} as const;

export type ApiErrorKind = (typeof API_ERROR_KIND)[keyof typeof API_ERROR_KIND];

/** Códigos de negocio conocidos por la documentación del backend. */
export const BUSINESS_ERROR_CODES = {
  EVENT_CONFLICT: "EVENT_CONFLICT",
  ADVISOR_UNAVAILABLE: "ADVISOR_UNAVAILABLE",
  COMPANY_INACTIVE: "COMPANY_INACTIVE",
} as const;

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly code?: string;
  readonly fieldErrors: FieldErrors;
  readonly payload?: unknown;

  constructor(params: {
    message: string;
    status: number;
    kind: ApiErrorKind;
    code?: string;
    fieldErrors?: FieldErrors;
    payload?: unknown;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.kind = params.kind;
    this.code = params.code;
    this.fieldErrors = params.fieldErrors ?? {};
    this.payload = params.payload;
  }

  get isSessionExpired() {
    return this.kind === API_ERROR_KIND.UNAUTHORIZED;
  }

  get isForbidden() {
    return this.kind === API_ERROR_KIND.FORBIDDEN;
  }

  get isNotFound() {
    return this.kind === API_ERROR_KIND.NOT_FOUND;
  }

  /** Conflicto de agenda: el asesor ya tiene un evento en ese rango. */
  get isScheduleConflict() {
    return (
      this.code === BUSINESS_ERROR_CODES.EVENT_CONFLICT ||
      this.code === BUSINESS_ERROR_CODES.ADVISOR_UNAVAILABLE ||
      this.kind === API_ERROR_KIND.CONFLICT
    );
  }

  get hasFieldErrors() {
    return Object.keys(this.fieldErrors).length > 0;
  }
}

const GENERIC_MESSAGES: Record<ApiErrorKind, string> = {
  NETWORK: "No fue posible conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
  TIMEOUT: "El servidor tardó demasiado en responder. Inténtalo de nuevo.",
  UNAUTHORIZED: "Tu sesión expiró. Inicia sesión nuevamente.",
  FORBIDDEN: "No tienes permisos para realizar esta acción.",
  NOT_FOUND: "No encontramos el recurso solicitado o no está dentro de tu alcance.",
  VALIDATION: "Revisa los datos ingresados.",
  CONFLICT: "El horario seleccionado ya no está disponible.",
  SERVER: "Ocurrió un error en el servidor. Inténtalo de nuevo en unos minutos.",
  UNKNOWN: "Ocurrió un error inesperado.",
};

const BUSINESS_MESSAGES: Record<string, string> = {
  EVENT_CONFLICT:
    "El asesor seleccionado ya tiene un evento programado en este horario. Selecciona otro horario o asesor.",
  ADVISOR_UNAVAILABLE: "El asesor no está disponible en el horario seleccionado.",
  COMPANY_INACTIVE: "La inmobiliaria no está activa. Contacta al administrador.",
};

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return API_ERROR_KIND.UNAUTHORIZED;
  if (status === 403) return API_ERROR_KIND.FORBIDDEN;
  if (status === 404) return API_ERROR_KIND.NOT_FOUND;
  if (status === 409) return API_ERROR_KIND.CONFLICT;
  if (status === 400 || status === 422) return API_ERROR_KIND.VALIDATION;
  if (status >= 500) return API_ERROR_KIND.SERVER;
  return API_ERROR_KIND.UNKNOWN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toMessageList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

/** Campos que no representan errores de formulario. */
const NON_FIELD_KEYS = new Set(["detail", "error", "code", "message", "non_field_errors"]);

/**
 * Convierte un cuerpo de error del backend en un `ApiError` con mensaje legible
 * en español y errores asociados a campos cuando existan.
 */
export function normalizeApiError(status: number, body: unknown): ApiError {
  const kind = kindFromStatus(status);
  const fieldErrors: FieldErrors = {};
  let code: string | undefined;
  let message: string | undefined;

  if (isRecord(body)) {
    // {"error": {"code": "...", "message": "..."}}
    const errorBlock = body.error;
    if (isRecord(errorBlock)) {
      if (typeof errorBlock.code === "string") code = errorBlock.code;
      if (typeof errorBlock.message === "string") message = errorBlock.message;
      if (isRecord(errorBlock.details)) {
        for (const [key, value] of Object.entries(errorBlock.details)) {
          const messages = toMessageList(value);
          if (messages.length > 0) fieldErrors[key] = messages;
        }
      }
    } else if (typeof errorBlock === "string") {
      message = errorBlock;
    }

    if (!code && typeof body.code === "string") code = body.code;
    if (!message && typeof body.detail === "string") message = body.detail;
    if (!message && typeof body.message === "string") message = body.message;

    const nonField = toMessageList(body.non_field_errors);
    if (nonField.length > 0) {
      fieldErrors.non_field_errors = nonField;
      if (!message) message = nonField[0];
    }

    for (const [key, value] of Object.entries(body)) {
      if (NON_FIELD_KEYS.has(key)) continue;
      const messages = toMessageList(value);
      if (messages.length > 0) fieldErrors[key] = messages;
    }
  } else if (typeof body === "string" && body.trim() !== "") {
    // Evita filtrar HTML de páginas de error a la interfaz.
    if (!body.trimStart().startsWith("<")) message = body;
  }

  // Un código de negocio conocido gana al mensaje crudo del backend.
  if (code && BUSINESS_MESSAGES[code]) {
    message = BUSINESS_MESSAGES[code];
  }

  if (!message && kind === API_ERROR_KIND.VALIDATION && Object.keys(fieldErrors).length > 0) {
    message = Object.values(fieldErrors)[0][0];
  }

  return new ApiError({
    message: message ?? GENERIC_MESSAGES[kind],
    status,
    kind,
    code,
    fieldErrors,
    payload: body,
  });
}

export function networkError(kind: "NETWORK" | "TIMEOUT" = "NETWORK"): ApiError {
  return new ApiError({
    message: GENERIC_MESSAGES[kind],
    status: 0,
    kind: API_ERROR_KIND[kind],
  });
}

/** Mensaje seguro para mostrar al usuario a partir de cualquier error. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return GENERIC_MESSAGES.UNKNOWN;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
