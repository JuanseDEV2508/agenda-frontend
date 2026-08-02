import { describe, expect, it } from "vitest";

import {
  composeCompany,
  findAdvisorByEmail,
  findUserByEmail,
  parseMePermissions,
} from "@/lib/auth/session-lookups";

/**
 * Resolución de la identidad sin `GET /users/me/`
 * (ver docs/frontend-api-analysis.md §3).
 */

describe("empresa actual", () => {
  it("lee id, nombre y zona horaria", () => {
    const company = composeCompany({
      id: "uuid",
      name: "Inmobiliaria Norte",
      timezone: "America/Bogota",
      status: "ACTIVE",
    });

    expect(company).toEqual({
      id: "uuid",
      name: "Inmobiliaria Norte",
      timezone: "America/Bogota",
      status: "ACTIVE",
    });
  });

  it("usa una zona horaria por defecto si el backend no la envía", () => {
    const company = composeCompany({ id: "uuid", name: "Inmobiliaria Norte" });
    expect(company.timezone).toBe("America/Bogota");
  });

  it("falla de forma explícita ante una respuesta incompleta", () => {
    expect(() => composeCompany({ id: "uuid" })).toThrow();
    expect(() => composeCompany("texto")).toThrow();
  });
});

describe("GET /users/me/permissions/", () => {
  const payload = {
    user: {
      id: "uuid",
      email: "asesor@inmobiliaria.co",
      full_name: "Carlos Pérez",
      role: "ADVISOR",
      company_id: "uuid",
    },
    permissions: {
      manage_users: false,
      manage_advisors: false,
      manage_supervisions: false,
      manage_clients: true,
      manage_scheduling_configuration: false,
      view_company_indicators: false,
      view_supervisor_indicators: false,
      view_own_indicators: true,
      view_all_company_events: false,
      view_supervised_advisor_events: false,
      view_own_events: true,
      create_events: true,
      reassign_events: false,
      edit_advisor_availability: true,
      cancel_events: true,
      complete_events: true,
    },
  };

  it("lee usuario y capacidades del ejemplo del contrato", () => {
    const result = parseMePermissions(payload);

    expect(result?.id).toBe("uuid");
    expect(result?.email).toBe("asesor@inmobiliaria.co");
    expect(result?.fullName).toBe("Carlos Pérez");
    expect(result?.role).toBe("ADVISOR");
    expect(result?.permissions.create_events).toBe(true);
    expect(result?.permissions.reassign_events).toBe(false);
    expect(result?.permissions.manage_clients).toBe(true);
  });

  it("deniega toda capacidad ausente en lugar de concederla", () => {
    const result = parseMePermissions({
      user: { id: "uuid", role: "ADMIN" },
      permissions: { create_events: true },
    });

    expect(result?.permissions.create_events).toBe(true);
    expect(result?.permissions.cancel_events).toBe(false);
    expect(result?.permissions.view_all_company_events).toBe(false);
  });

  it("sólo acepta el booleano true, no valores equivalentes", () => {
    const result = parseMePermissions({
      user: { id: "uuid", role: "ADMIN" },
      permissions: { create_events: "true", cancel_events: 1 },
    });

    expect(result?.permissions.create_events).toBe(false);
    expect(result?.permissions.cancel_events).toBe(false);
  });

  it("descarta un rol desconocido para no promover al usuario", () => {
    const result = parseMePermissions({
      user: { id: "uuid", role: "SUPERADMIN" },
      permissions: {},
    });
    expect(result?.role).toBeNull();
  });

  it("devuelve null ante una respuesta que no reconoce", () => {
    expect(parseMePermissions(null)).toBeNull();
    expect(parseMePermissions({ otra_cosa: 1 })).toBeNull();
  });
});

describe("búsqueda del usuario propio", () => {
  const payload = {
    count: 2,
    results: [
      { id: "u1", email: "admin@inmobiliaria.co", first_name: "Ada", last_name: "López", role: "ADMIN" },
      { id: "u2", email: "asesor@inmobiliaria.co", first_name: "Carlos", last_name: "Pérez", role: "ADVISOR" },
    ],
  };

  it("encuentra el registro propio por correo, sin distinguir mayúsculas", () => {
    const user = findUserByEmail(payload, "ADMIN@Inmobiliaria.co");
    expect(user).toEqual({ id: "u1", fullName: "Ada López", role: "ADMIN" });
  });

  it("devuelve null si el correo no está en el listado", () => {
    expect(findUserByEmail(payload, "otro@inmobiliaria.co")).toBeNull();
  });

  it("no acepta un rol desconocido", () => {
    const user = findUserByEmail(
      { results: [{ id: "u3", email: "x@y.co", role: "SUPERADMIN" }] },
      "x@y.co",
    );
    expect(user?.role).toBeNull();
  });
});

describe("búsqueda del perfil de asesor propio", () => {
  it("localiza el asesor por el correo anidado del usuario", () => {
    const advisor = findAdvisorByEmail(
      {
        results: [
          {
            id: "advisor-1",
            code: "A-01",
            user: { id: "u2", first_name: "Carlos", last_name: "Pérez", email: "asesor@inmobiliaria.co" },
          },
        ],
      },
      "asesor@inmobiliaria.co",
    );

    expect(advisor?.id).toBe("advisor-1");
    expect(advisor?.name).toBe("Carlos Pérez");
  });

  it("devuelve null cuando no hay coincidencia", () => {
    expect(findAdvisorByEmail({ results: [] }, "asesor@inmobiliaria.co")).toBeNull();
  });
});
