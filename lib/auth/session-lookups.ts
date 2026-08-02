import {
  extractResults,
  isRecord,
  normalizeAdvisor,
  pick,
} from "@/features/agenda/api/normalizers";
import type { Advisor } from "@/features/agenda/types";
import type { CompanySummary, UserPermissions, UserRole } from "@/features/auth/types";
import { isUserRole, NO_PERMISSIONS, PERMISSION_KEYS } from "@/features/auth/types";
import { DEFAULT_TIMEZONE } from "@/lib/dates";

/**
 * Funciones puras usadas al construir la sesión. Están separadas de
 * `resolve-session-user.ts` para poder probarlas sin tocar la red.
 */

export function composeCompany(payload: unknown): CompanySummary {
  if (!isRecord(payload)) {
    throw new Error("La respuesta de /companies/current/ no tiene el formato esperado.");
  }

  const id = pick(payload, "id", "uuid");
  const name = pick(payload, "name", "legal_name");

  if (!id || !name) {
    throw new Error("La respuesta de /companies/current/ no incluye id o name.");
  }

  return {
    id,
    name,
    // Si el backend no envía zona horaria se usa la de operación por defecto;
    // queda registrado en el perfil para que sea visible.
    timezone: pick(payload, "timezone", "time_zone") ?? DEFAULT_TIMEZONE,
    status: pick(payload, "status") ?? undefined,
  };
}

export interface MePermissionsResult {
  id: string | null;
  email: string | null;
  fullName: string | null;
  role: UserRole | null;
  permissions: UserPermissions;
}

/**
 * Interpreta `GET /users/me/permissions/`.
 *
 * Sólo se aceptan capacidades **explícitamente `true`**: una clave ausente o con
 * un valor no booleano se considera denegada. Nunca se concede una capacidad por
 * omisión.
 */
export function parseMePermissions(payload: unknown): MePermissionsResult | null {
  if (!isRecord(payload)) return null;

  const userBlock = isRecord(payload.user) ? payload.user : null;
  const permissionsBlock = isRecord(payload.permissions) ? payload.permissions : null;

  if (!userBlock && !permissionsBlock) return null;

  const permissions = { ...NO_PERMISSIONS };
  if (permissionsBlock) {
    for (const key of PERMISSION_KEYS) {
      permissions[key] = permissionsBlock[key] === true;
    }
  }

  const roleValue = userBlock ? pick(userBlock, "role") : null;
  const first = userBlock ? pick(userBlock, "first_name") : null;
  const last = userBlock ? pick(userBlock, "last_name") : null;
  const composed = [first, last].filter(Boolean).join(" ").trim();

  return {
    id: userBlock ? pick(userBlock, "id", "uuid") : null,
    email: userBlock ? pick(userBlock, "email") : null,
    fullName: userBlock
      ? (pick(userBlock, "full_name", "name") ?? (composed !== "" ? composed : null))
      : null,
    role: isUserRole(roleValue) ? roleValue : null,
    permissions,
  };
}

export interface OwnUser {
  id: string;
  fullName: string | null;
  role: UserRole | null;
}

function emailMatches(candidate: string | null, email: string): boolean {
  return candidate !== null && candidate.trim().toLowerCase() === email.trim().toLowerCase();
}

/** Busca el registro propio dentro de `GET /users/`. */
export function findUserByEmail(payload: unknown, email: string): OwnUser | null {
  for (const raw of extractResults(payload)) {
    if (!isRecord(raw)) continue;
    if (!emailMatches(pick(raw, "email", "username"), email)) continue;

    const id = pick(raw, "id", "uuid");
    if (!id) continue;

    const roleValue = pick(raw, "role");
    const first = pick(raw, "first_name");
    const last = pick(raw, "last_name");
    const composed = [first, last].filter(Boolean).join(" ").trim();

    return {
      id,
      fullName: pick(raw, "full_name", "name") ?? (composed !== "" ? composed : null),
      role: isUserRole(roleValue) ? roleValue : null,
    };
  }

  return null;
}

/** Busca el perfil de asesor propio dentro de `GET /advisors/`. */
export function findAdvisorByEmail(
  payload: unknown,
  email: string,
): (Advisor & { role: UserRole | null }) | null {
  for (const raw of extractResults(payload)) {
    const advisor = normalizeAdvisor(raw);
    if (!advisor) continue;
    if (!emailMatches(advisor.email ?? null, email)) continue;

    return { ...advisor, role: isUserRole(advisor.role) ? advisor.role : null };
  }

  return null;
}
