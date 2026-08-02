import type { AgendaEvent, EventStatus, EventType } from "@/features/agenda/types";
import type {
  AuthenticatedUser,
  CompanySummary,
  Session,
  UserPermissions,
} from "@/features/auth/types";
import { NO_PERMISSIONS } from "@/features/auth/types";

export const BOGOTA = "America/Bogota";

export function makePermissions(
  overrides: Partial<UserPermissions> = {},
): UserPermissions {
  return { ...NO_PERMISSIONS, ...overrides };
}

/** Capacidades típicas de un asesor, según el ejemplo del contrato. */
export const ADVISOR_PERMISSIONS = makePermissions({
  manage_clients: true,
  view_own_indicators: true,
  view_own_events: true,
  create_events: true,
  edit_advisor_availability: true,
  cancel_events: true,
  complete_events: true,
});

export const ADMIN_PERMISSIONS = makePermissions({
  manage_users: true,
  manage_advisors: true,
  manage_supervisions: true,
  manage_clients: true,
  manage_scheduling_configuration: true,
  view_company_indicators: true,
  view_all_company_events: true,
  view_own_events: true,
  create_events: true,
  reassign_events: true,
  edit_advisor_availability: true,
  cancel_events: true,
  complete_events: true,
});

export function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    email: "asesor@inmobiliaria.co",
    fullName: "Carlos Pérez",
    role: "ADVISOR",
    advisorId: "advisor-1",
    permissions: ADVISOR_PERMISSIONS,
    roleConfirmed: true,
    ...overrides,
  };
}

export function makeCompany(overrides: Partial<CompanySummary> = {}): CompanySummary {
  return {
    id: "company-1",
    name: "Inmobiliaria Norte",
    timezone: BOGOTA,
    status: "ACTIVE",
    ...overrides,
  };
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  return { user: makeUser(), company: makeCompany(), ...overrides };
}

export function makeEvent(overrides: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: "event-1",
    title: "Visita apartamento",
    eventType: "PROPERTY_VISIT" as EventType,
    status: "PENDING" as EventStatus,
    startAt: "2026-08-10T15:00:00-05:00",
    endAt: "2026-08-10T16:00:00-05:00",
    timezone: BOGOTA,
    advisor: { id: "advisor-1", name: "Carlos Pérez" },
    client: { id: "client-1", name: "Laura Gómez", phone: "+573001234567", email: null },
    ...overrides,
  };
}
