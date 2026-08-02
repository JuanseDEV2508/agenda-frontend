import type { Advisor } from "@/features/agenda/types";
import { apiClient } from "@/lib/api/client";

import { extractResults, isRecord, normalizeAdvisor, pick } from "./normalizers";

/**
 * `GET /advisors/` — el backend limita el listado al alcance del rol:
 * un ADMIN ve los de su empresa, un supervisor su equipo. El frontend NO
 * construye consultas globales ni intenta ampliar ese alcance.
 */
export async function fetchAdvisors(signal?: AbortSignal): Promise<Advisor[]> {
  const data = await apiClient.get<unknown>("advisors", {
    searchParams: { page_size: 200 },
    signal,
  });

  return extractResults(data)
    .map(normalizeAdvisor)
    .filter((advisor): advisor is Advisor => advisor !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function fetchAdvisor(
  advisorId: string,
  signal?: AbortSignal,
): Promise<Advisor | null> {
  const data = await apiClient.get<unknown>(`advisors/${advisorId}`, { signal });
  return normalizeAdvisor(data);
}

export interface AdvisorAvailabilityStatus {
  isAvailable: boolean | null;
  label: string | null;
}

/**
 * `GET /advisors/{id}/availability-status/`
 *
 * ⚠️ La documentación menciona la acción pero no el esquema de la respuesta.
 * Se interpreta de forma tolerante y, si no se reconoce nada, se devuelve
 * `null` y la interfaz simplemente no muestra el indicador.
 */
export async function fetchAdvisorAvailabilityStatus(
  advisorId: string,
  signal?: AbortSignal,
): Promise<AdvisorAvailabilityStatus | null> {
  const data = await apiClient.get<unknown>(`advisors/${advisorId}/availability-status`, {
    signal,
  });

  if (!isRecord(data)) return null;

  const flag =
    typeof data.is_available === "boolean"
      ? data.is_available
      : typeof data.available === "boolean"
        ? data.available
        : null;

  const label = pick(data, "status", "availability_status", "message");

  if (flag === null && label === null) return null;
  return { isAvailable: flag, label };
}
