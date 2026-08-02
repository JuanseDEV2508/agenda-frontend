import type { AvailabilityBlock, SchedulingConfiguration } from "@/features/agenda/types";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import {
  extractResults,
  normalizeAvailabilityBlock,
  normalizeSchedulingConfiguration,
} from "./normalizers";

/**
 * Disponibilidad.
 *
 * ⚠️ IMPORTANTE (docs/frontend-api-analysis.md §4.6): el backend **no expone un
 * endpoint de "slots disponibles" para la agenda interna**. El único cálculo real
 * vive en la integración de chatbot y no se consume desde aquí.
 *
 * Por eso el frontend NO deshabilita horarios ni simula disponibilidad: mostrar
 * como libre un hueco sin eventos sería falso (dependen buffers, vacaciones,
 * máximo diario y configuración de empresa). Se muestran los bloques
 * configurados como ayuda informativa y el backend sigue siendo la autoridad:
 * un horario inválido se rechaza con `EVENT_CONFLICT`.
 *
 * Cuando exista el endpoint de slots, este archivo es el punto de integración.
 */
export async function fetchAvailabilityBlocks(
  advisorId: string,
  signal?: AbortSignal,
): Promise<AvailabilityBlock[]> {
  const data = await apiClient.get<unknown>("advisor-availabilities", {
    searchParams: { advisor: advisorId, page_size: 100 },
    signal,
  });

  return extractResults(data)
    .map(normalizeAvailabilityBlock)
    .filter((block): block is AvailabilityBlock => block !== null && block.isActive);
}

/**
 * `GET /scheduling-configurations/default/` está documentado como "Solo ADMIN".
 * Se consulta de forma opcional: un 403 o 404 no es un error para el usuario,
 * simplemente no hay configuración disponible.
 */
export async function fetchDefaultSchedulingConfiguration(
  signal?: AbortSignal,
): Promise<SchedulingConfiguration | null> {
  try {
    const data = await apiClient.get<unknown>("scheduling-configurations/default", {
      signal,
    });
    return normalizeSchedulingConfiguration(data);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}
