import type { AgendaEvent, EventStatus } from "@/features/agenda/types";
import type { AuthenticatedUser, PermissionKey } from "@/features/auth/types";

/**
 * Reglas de permisos centralizadas.
 *
 * Fuente principal: las capacidades efectivas que devuelve
 * `GET /users/me/permissions/` y que viajan en la sesión. Cuando el backend no
 * las entrega (`permissions === null`), se aplican reglas equivalentes basadas
 * en el rol para no dejar la interfaz inutilizable.
 *
 * IMPORTANTE: esto controla **qué se muestra**, no la seguridad. El backend
 * sigue validando cada operación y toda respuesta `403` se maneja en la
 * interfaz (ver lib/api/errors.ts).
 */

/** Estados en los que el evento ya no admite cambios operativos. */
const TERMINAL_STATUSES: ReadonlySet<EventStatus> = new Set<EventStatus>([
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "NO_SHOW",
]);

export function isTerminalStatus(status: EventStatus | null): boolean {
  return status !== null && TERMINAL_STATUSES.has(status);
}

/**
 * Consulta una capacidad concreta.
 * `fallback` se usa sólo cuando el backend no entregó las capacidades.
 */
export function hasPermission(
  user: AuthenticatedUser | null,
  key: PermissionKey,
  fallback = false,
): boolean {
  if (!user) return false;
  if (!user.permissions) return fallback;
  return user.permissions[key] === true;
}

export function isAdmin(user: AuthenticatedUser | null): boolean {
  return user?.role === "ADMIN";
}

export function isSupervisor(user: AuthenticatedUser | null): boolean {
  return user?.role === "SUPERVISOR";
}

export function isAdvisor(user: AuthenticatedUser | null): boolean {
  return user?.role === "ADVISOR";
}

/** El evento pertenece al asesor del usuario. */
export function isEventOwner(
  user: AuthenticatedUser | null,
  event: Pick<AgendaEvent, "advisor"> | null,
): boolean {
  if (!user?.advisorId || !event?.advisor?.id) return false;
  return user.advisorId === event.advisor.id;
}

/**
 * Puede ver agendas distintas a la suya.
 * El alcance real (toda la empresa vs. sólo su equipo) lo determina el backend
 * en `GET /advisors/`; el frontend no construye consultas globales.
 */
export function canViewAllAdvisors(user: AuthenticatedUser | null): boolean {
  if (!user) return false;
  if (user.permissions) {
    return (
      user.permissions.view_all_company_events ||
      user.permissions.view_supervised_advisor_events
    );
  }
  return isAdmin(user) || isSupervisor(user);
}

/** El módulo de métricas está disponible para cualquier usuario autenticado. */
export function canViewMetrics(user: AuthenticatedUser | null): boolean {
  return user !== null;
}

/** Las métricas del inbox son de empresa; el backend las reserva a este alcance. */
export function canViewInboxMetrics(user: AuthenticatedUser | null): boolean {
  if (!user) return false;
  if (!user.permissions) return isAdmin(user) || isSupervisor(user);
  return user.permissions.view_company_indicators;
}

/** Muestra u oculta el selector de asesor en filtros y formularios. */
export function canSelectAdvisor(user: AuthenticatedUser | null): boolean {
  return canViewAllAdvisors(user);
}

export function canCreateEvent(user: AuthenticatedUser | null): boolean {
  if (!user) return false;
  return hasPermission(user, "create_events", true);
}

/** Alta rápida de cliente desde el formulario de evento. */
export function canManageClients(user: AuthenticatedUser | null): boolean {
  if (!user) return false;
  return hasPermission(user, "manage_clients", true);
}

export function canEditEvent(
  user: AuthenticatedUser | null,
  event: AgendaEvent | null,
): boolean {
  if (!user || !event) return false;
  if (isTerminalStatus(event.status)) return false;
  // El backend no expone una capacidad específica de edición: se usa la de
  // creación, que refleja si el usuario puede operar sobre la agenda.
  if (!hasPermission(user, "create_events", true)) return false;
  if (canViewAllAdvisors(user)) return true;
  return isEventOwner(user, event);
}

export function canReassignEvent(
  user: AuthenticatedUser | null,
  event: AgendaEvent | null,
): boolean {
  if (!user || !event) return false;
  if (isTerminalStatus(event.status)) return false;
  if (user.permissions) return user.permissions.reassign_events;
  return canViewAllAdvisors(user);
}

export function canConfirmEvent(
  user: AuthenticatedUser | null,
  event: AgendaEvent | null,
): boolean {
  if (!canActOnEvent(user, event)) return false;
  return event!.status === "PENDING";
}

export function canStartEvent(
  user: AuthenticatedUser | null,
  event: AgendaEvent | null,
): boolean {
  if (!canActOnEvent(user, event)) return false;
  return event!.status === "CONFIRMED";
}

export function canCompleteEvent(
  user: AuthenticatedUser | null,
  event: AgendaEvent | null,
): boolean {
  if (!canActOnEvent(user, event)) return false;
  if (!hasPermission(user, "complete_events", true)) return false;
  return event!.status === "CONFIRMED" || event!.status === "IN_PROGRESS";
}

export function canCancelEvent(
  user: AuthenticatedUser | null,
  event: AgendaEvent | null,
): boolean {
  if (!canActOnEvent(user, event)) return false;
  if (!hasPermission(user, "cancel_events", true)) return false;
  // El backend no permite cancelar un evento completado o ya reprogramado.
  return (
    event!.status !== "COMPLETED" &&
    event!.status !== "RESCHEDULED" &&
    event!.status !== "CANCELLED"
  );
}

export function canMarkNoShow(
  user: AuthenticatedUser | null,
  event: AgendaEvent | null,
): boolean {
  if (!canActOnEvent(user, event)) return false;
  return (
    event!.status === "PENDING" ||
    event!.status === "CONFIRMED" ||
    event!.status === "IN_PROGRESS"
  );
}

export function canRescheduleEvent(
  user: AuthenticatedUser | null,
  event: AgendaEvent | null,
): boolean {
  if (!canActOnEvent(user, event)) return false;
  if (!hasPermission(user, "create_events", true)) return false;
  return !isTerminalStatus(event!.status);
}

/**
 * Base común: hay usuario y evento, y el usuario tiene relación con él (es suyo
 * o puede ver varias agendas). Si el usuario no tiene perfil de asesor, el
 * backend ya limitó lo que puede ver, así que se permite operar y es él quien
 * decide con un `403` si corresponde.
 */
function canActOnEvent(
  user: AuthenticatedUser | null,
  event: AgendaEvent | null,
): boolean {
  if (!user || !event) return false;
  return canViewAllAdvisors(user) || isEventOwner(user, event) || user.advisorId === null;
}

/** ¿Hay al menos una acción disponible? Evita renderizar menús vacíos. */
export function hasAnyEventAction(
  user: AuthenticatedUser | null,
  event: AgendaEvent | null,
): boolean {
  return (
    canConfirmEvent(user, event) ||
    canStartEvent(user, event) ||
    canCompleteEvent(user, event) ||
    canCancelEvent(user, event) ||
    canMarkNoShow(user, event) ||
    canRescheduleEvent(user, event) ||
    canReassignEvent(user, event) ||
    canEditEvent(user, event)
  );
}
