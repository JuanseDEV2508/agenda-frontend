import { describe, expect, it } from "vitest";

import {
  canCancelEvent,
  canCompleteEvent,
  canConfirmEvent,
  canCreateEvent,
  canEditEvent,
  canManageClients,
  canMarkNoShow,
  canReassignEvent,
  canRescheduleEvent,
  canSelectAdvisor,
  canStartEvent,
  canViewAllAdvisors,
  hasAnyEventAction,
  hasPermission,
  isEventOwner,
} from "@/lib/permissions";

import {
  ADMIN_PERMISSIONS,
  ADVISOR_PERMISSIONS,
  makePermissions,
  makeUser,
  makeEvent,
} from "./factories";

const admin = makeUser({
  role: "ADMIN",
  advisorId: null,
  id: "admin-1",
  permissions: ADMIN_PERMISSIONS,
});

const supervisor = makeUser({
  role: "SUPERVISOR",
  advisorId: "advisor-9",
  permissions: makePermissions({
    view_supervised_advisor_events: true,
    view_own_events: true,
    create_events: true,
    cancel_events: true,
    complete_events: true,
  }),
});

const advisor = makeUser({ role: "ADVISOR", advisorId: "advisor-1" });
const otherAdvisor = makeUser({ role: "ADVISOR", advisorId: "advisor-2" });

describe("alcance según las capacidades del backend", () => {
  it("ADMIN y SUPERVISOR pueden consultar varias agendas", () => {
    expect(canViewAllAdvisors(admin)).toBe(true);
    expect(canViewAllAdvisors(supervisor)).toBe(true);
  });

  it("ADVISOR no ve selectores globales de asesor", () => {
    expect(canViewAllAdvisors(advisor)).toBe(false);
    expect(canSelectAdvisor(advisor)).toBe(false);
  });

  it("identifica al dueño del evento", () => {
    const event = makeEvent();
    expect(isEventOwner(advisor, event)).toBe(true);
    expect(isEventOwner(otherAdvisor, event)).toBe(false);
  });

  it("lee una capacidad concreta", () => {
    expect(hasPermission(advisor, "manage_clients")).toBe(true);
    expect(hasPermission(advisor, "reassign_events")).toBe(false);
    expect(hasPermission(null, "create_events", true)).toBe(false);
  });
});

describe("capacidades desactivadas por el backend", () => {
  const soloLectura = makeUser({
    permissions: makePermissions({ view_own_events: true }),
  });

  it("sin create_events no se puede crear ni editar", () => {
    expect(canCreateEvent(soloLectura)).toBe(false);
    expect(canEditEvent(soloLectura, makeEvent())).toBe(false);
    expect(canRescheduleEvent(soloLectura, makeEvent())).toBe(false);
  });

  it("sin cancel_events no se ofrece cancelar", () => {
    const sinCancelar = makeUser({
      permissions: makePermissions({ ...ADVISOR_PERMISSIONS, cancel_events: false }),
    });
    expect(canCancelEvent(sinCancelar, makeEvent({ status: "CONFIRMED" }))).toBe(false);
    expect(canCancelEvent(advisor, makeEvent({ status: "CONFIRMED" }))).toBe(true);
  });

  it("sin complete_events no se ofrece completar", () => {
    const sinCompletar = makeUser({
      permissions: makePermissions({ ...ADVISOR_PERMISSIONS, complete_events: false }),
    });
    expect(canCompleteEvent(sinCompletar, makeEvent({ status: "IN_PROGRESS" }))).toBe(false);
  });

  it("sin reassign_events no se puede reasignar, aunque sea ADMIN", () => {
    const adminSinReasignar = makeUser({
      role: "ADMIN",
      advisorId: null,
      permissions: makePermissions({ ...ADMIN_PERMISSIONS, reassign_events: false }),
    });
    expect(canReassignEvent(adminSinReasignar, makeEvent())).toBe(false);
    expect(canReassignEvent(admin, makeEvent())).toBe(true);
  });

  it("sin manage_clients no se ofrece el alta rápida de cliente", () => {
    const sinClientes = makeUser({
      permissions: makePermissions({ ...ADVISOR_PERMISSIONS, manage_clients: false }),
    });
    expect(canManageClients(sinClientes)).toBe(false);
    expect(canManageClients(advisor)).toBe(true);
  });
});

describe("respaldo cuando el backend no entrega capacidades", () => {
  const adminSinPermisos = makeUser({ role: "ADMIN", advisorId: null, permissions: null });
  const asesorSinPermisos = makeUser({ role: "ADVISOR", permissions: null });

  it("aplica reglas por rol", () => {
    expect(canViewAllAdvisors(adminSinPermisos)).toBe(true);
    expect(canViewAllAdvisors(asesorSinPermisos)).toBe(false);
    expect(canReassignEvent(adminSinPermisos, makeEvent())).toBe(true);
    expect(canReassignEvent(asesorSinPermisos, makeEvent())).toBe(false);
  });

  it("no deja la interfaz inutilizable", () => {
    expect(canCreateEvent(asesorSinPermisos)).toBe(true);
    expect(canCancelEvent(asesorSinPermisos, makeEvent({ status: "PENDING" }))).toBe(true);
  });
});

describe("transiciones de estado", () => {
  it("confirmar sólo desde PENDING", () => {
    expect(canConfirmEvent(advisor, makeEvent({ status: "PENDING" }))).toBe(true);
    expect(canConfirmEvent(advisor, makeEvent({ status: "CONFIRMED" }))).toBe(false);
    expect(canConfirmEvent(advisor, makeEvent({ status: "COMPLETED" }))).toBe(false);
  });

  it("iniciar sólo desde CONFIRMED", () => {
    expect(canStartEvent(advisor, makeEvent({ status: "CONFIRMED" }))).toBe(true);
    expect(canStartEvent(advisor, makeEvent({ status: "PENDING" }))).toBe(false);
  });

  it("completar desde CONFIRMED o IN_PROGRESS", () => {
    expect(canCompleteEvent(advisor, makeEvent({ status: "CONFIRMED" }))).toBe(true);
    expect(canCompleteEvent(advisor, makeEvent({ status: "IN_PROGRESS" }))).toBe(true);
    expect(canCompleteEvent(advisor, makeEvent({ status: "PENDING" }))).toBe(false);
  });

  it("no permite cancelar un evento completado ni ya reprogramado", () => {
    expect(canCancelEvent(advisor, makeEvent({ status: "PENDING" }))).toBe(true);
    expect(canCancelEvent(advisor, makeEvent({ status: "COMPLETED" }))).toBe(false);
    expect(canCancelEvent(advisor, makeEvent({ status: "RESCHEDULED" }))).toBe(false);
    expect(canCancelEvent(advisor, makeEvent({ status: "CANCELLED" }))).toBe(false);
  });

  it("marca inasistencia sólo en eventos vigentes", () => {
    expect(canMarkNoShow(advisor, makeEvent({ status: "CONFIRMED" }))).toBe(true);
    expect(canMarkNoShow(advisor, makeEvent({ status: "COMPLETED" }))).toBe(false);
  });

  it("no reprograma eventos en estado terminal", () => {
    expect(canRescheduleEvent(advisor, makeEvent({ status: "CONFIRMED" }))).toBe(true);
    expect(canRescheduleEvent(advisor, makeEvent({ status: "CANCELLED" }))).toBe(false);
  });
});

describe("restricciones sobre un evento ajeno", () => {
  const event = makeEvent();

  it("un asesor no puede editar el evento de otro asesor", () => {
    expect(canEditEvent(otherAdvisor, event)).toBe(false);
    expect(canConfirmEvent(otherAdvisor, event)).toBe(false);
    expect(hasAnyEventAction(otherAdvisor, event)).toBe(false);
  });

  it("un administrador sí puede editarlo y reasignarlo", () => {
    expect(canEditEvent(admin, event)).toBe(true);
    expect(canReassignEvent(admin, event)).toBe(true);
  });

  it("un asesor nunca puede reasignar", () => {
    expect(canReassignEvent(advisor, event)).toBe(false);
  });

  it("no se puede editar un evento en estado terminal, ni siendo ADMIN", () => {
    expect(canEditEvent(admin, makeEvent({ status: "COMPLETED" }))).toBe(false);
  });
});

describe("sin usuario o sin evento", () => {
  it("no concede ninguna acción", () => {
    expect(canEditEvent(null, makeEvent())).toBe(false);
    expect(canConfirmEvent(advisor, null)).toBe(false);
    expect(canCreateEvent(null)).toBe(false);
    expect(hasAnyEventAction(null, null)).toBe(false);
  });
});
