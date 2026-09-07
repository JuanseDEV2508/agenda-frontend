import { apiClient } from "@/lib/api/client";

import type { FollowUpDecision, FollowUpLead, FollowUpSendResult } from "../types";

/**
 * Cola de seguimiento de leads.
 *
 * El teléfono viaja en el **cuerpo** y nunca en la ruta: el proxy valida cada
 * segmento contra `^[A-Za-z0-9_-]+$` y el `+` de un teléfono lo haría fallar
 * antes de llegar al backend.
 */
export async function fetchFollowUps(
  filters: { advisor?: string; reason?: string } = {},
  signal?: AbortSignal,
) {
  const data = await apiClient.get<{ results: FollowUpLead[]; count: number }>("follow-ups", {
    searchParams: { advisor: filters.advisor, reason: filters.reason },
    signal,
  });
  return data.results ?? [];
}

export function decideFollowUp({ phone, status, dueAt, notes }: FollowUpDecision) {
  return apiClient.post<FollowUpLead>("follow-ups/decide", {
    body: { phone, status, due_at: dueAt ?? undefined, notes: notes || undefined },
  });
}

export function sendFollowUp(phone: string) {
  return apiClient.post<FollowUpSendResult>("follow-ups/send", { body: { phone } });
}
