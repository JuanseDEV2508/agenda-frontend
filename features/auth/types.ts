export const USER_ROLES = ["ADMIN", "SUPERVISOR", "ADVISOR"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  ADVISOR: "Asesor",
};

/** `GET /companies/current/` */
export interface CompanySummary {
  id: string;
  name: string;
  /** Zona horaria IANA de la inmobiliaria, p. ej. "America/Bogota". */
  timezone: string;
  status?: string;
}

/**
 * Capacidades efectivas del usuario (`GET /users/me/permissions/`).
 *
 * El backend las calcula combinando rol y configuración de la empresa. Se usan
 * para construir la interfaz; la validación real sigue siendo del backend en
 * cada operación.
 */
export const PERMISSION_KEYS = [
  "manage_users",
  "manage_advisors",
  "manage_supervisions",
  "manage_clients",
  "manage_scheduling_configuration",
  "view_company_indicators",
  "view_supervisor_indicators",
  "view_own_indicators",
  "view_all_company_events",
  "view_supervised_advisor_events",
  "view_own_events",
  "create_events",
  "reassign_events",
  "edit_advisor_availability",
  "cancel_events",
  "complete_events",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type UserPermissions = Record<PermissionKey, boolean>;

/** Todo denegado: punto de partida seguro si el backend no responde. */
export const NO_PERMISSIONS: UserPermissions = Object.fromEntries(
  PERMISSION_KEYS.map((key) => [key, false]),
) as UserPermissions;

export interface AuthenticatedUser {
  /** UUID del usuario si el backend lo pudo entregar. */
  id: string | null;
  email: string;
  fullName: string;
  role: UserRole;
  /**
   * UUID del asesor asociado al usuario, si tiene perfil de asesor.
   * Necesario para acotar la agenda a "mi agenda".
   */
  advisorId: string | null;
  /**
   * Capacidades efectivas. `null` cuando el backend aún no expone
   * `GET /users/me/permissions/`: en ese caso se aplican reglas por rol
   * (ver docs/frontend-api-analysis.md §3).
   */
  permissions: UserPermissions | null;
  /**
   * `false` cuando el rol no pudo confirmarse contra el backend y se degradó
   * al más restrictivo.
   */
  roleConfirmed: boolean;
}

export interface Session {
  user: AuthenticatedUser;
  company: CompanySummary;
}
