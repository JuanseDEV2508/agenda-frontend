import "server-only";

import type { AuthenticatedUser, CompanySummary, Session } from "@/features/auth/types";
import { backendRequest, backendRequestTolerant } from "@/lib/api/server-client";

import {
  composeCompany,
  findAdvisorByEmail,
  findUserByEmail,
  parseMePermissions,
} from "./session-lookups";

/**
 * Resuelve la identidad, el rol y las capacidades del usuario autenticado.
 *
 * Fuente principal: `GET /users/me/permissions/`, que devuelve el usuario y sus
 * capacidades efectivas ya combinadas con la configuración de la empresa.
 *
 * ⚠️ Ese endpoint aparece en la documentación pero **no está publicado en el
 * esquema OpenAPI de la instancia local** (ver docs/frontend-api-analysis.md §3).
 * Por eso se consulta de forma tolerante: si responde 404 o 403 se cae al
 * sondeo anterior por endpoints documentados y el rol se degrada al MÁS
 * RESTRICTIVO. Nunca se promueve un rol por inferencia.
 */
export async function resolveSessionUser(
  basicAuth: string,
  email: string,
): Promise<Session> {
  // 1. Empresa: valida credenciales y aporta la zona horaria de la agenda.
  const { data: companyPayload } = await backendRequest<unknown>({
    path: "companies/current",
    basicAuth,
  });

  const company: CompanySummary = composeCompany(companyPayload);

  // 2. Capacidades efectivas.
  const mePayload = await backendRequestTolerant<unknown>(
    { path: "users/me/permissions", basicAuth },
    [403, 404],
  );

  const me = mePayload ? parseMePermissions(mePayload) : null;

  if (!me) {
    console.warn(
      "[auth] GET /users/me/permissions/ no devolvió capacidades utilizables; se aplican reglas por rol.",
    );
  }

  // 3. Perfil de asesor propio: necesario para acotar "mi agenda" y para saber
  //    si un evento es suyo. El endpoint de permisos no devuelve `advisor_id`.
  const advisorsPayload = await backendRequestTolerant<unknown>(
    { path: "advisors", searchParams: { page_size: 200 }, basicAuth },
    [403, 404],
  );

  const ownAdvisor = advisorsPayload ? findAdvisorByEmail(advisorsPayload, email) : null;

  if (me?.role) {
    const user: AuthenticatedUser = {
      id: me.id,
      email: me.email ?? email,
      fullName: me.fullName ?? ownAdvisor?.name ?? email.split("@")[0],
      role: me.role,
      advisorId: ownAdvisor?.id ?? null,
      permissions: me.permissions,
      roleConfirmed: true,
    };

    return { user, company };
  }

  const probed = await resolveByProbing(basicAuth, email, ownAdvisor);

  // El endpoint respondió pero sin un rol reconocible: se conservan igualmente
  // las capacidades, que son la fuente de verdad para la interfaz.
  if (me) {
    return {
      user: {
        ...probed,
        id: me.id ?? probed.id,
        email: me.email ?? probed.email,
        fullName: me.fullName ?? probed.fullName,
        permissions: me.permissions,
      },
      company,
    };
  }

  return { user: probed, company };
}

/**
 * Estrategia de respaldo mientras `GET /users/me/permissions/` no esté
 * disponible: `GET /users/` está documentado como "Solo ADMIN", así que una
 * respuesta 200 identifica a un administrador. Si nada lo confirma se asume
 * `ADVISOR`, el rol más restrictivo.
 */
async function resolveByProbing(
  basicAuth: string,
  email: string,
  ownAdvisor: { id: string; name: string; role: string | null } | null,
): Promise<AuthenticatedUser> {
  const usersPayload = await backendRequestTolerant<unknown>(
    { path: "users", searchParams: { page_size: 200 }, basicAuth },
    [403, 404],
  );

  const ownUser = usersPayload ? findUserByEmail(usersPayload, email) : null;
  const explicitRole = ownUser?.role ?? null;
  const isAdminByProbe = usersPayload !== null;

  return {
    id: ownUser?.id ?? null,
    email,
    fullName: ownUser?.fullName ?? ownAdvisor?.name ?? email.split("@")[0],
    role: explicitRole ?? (isAdminByProbe ? "ADMIN" : "ADVISOR"),
    advisorId: ownAdvisor?.id ?? null,
    // Sin el endpoint de permisos no hay capacidades: se aplican reglas por rol.
    permissions: null,
    roleConfirmed: explicitRole !== null || isAdminByProbe,
  };
}
