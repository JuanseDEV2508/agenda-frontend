export type FollowUpReason = "CANCELLED" | "NO_SHOW" | "COMPLETED" | "INACTIVE";
export type FollowUpStatus = "SENT" | "DONE" | "DISMISSED" | "SNOOZED";

export interface FollowUpAdvisor {
  id: string;
  full_name: string;
}

/** Un lead en la cola. `client_id` es `null` si aún es solo un contacto de WhatsApp. */
export interface FollowUpLead {
  phone: string;
  name: string;
  reason: FollowUpReason;
  /** Desde cuándo espera. */
  since: string | null;
  client_id: string | null;
  contact_id: string | null;
  advisor: FollowUpAdvisor | null;
  source_event_id: string | null;
}

export interface FollowUpDecision {
  phone: string;
  status: FollowUpStatus;
  dueAt?: string | null;
  notes?: string;
}

/** `sent`, `failed:<motivo>` o `skipped:<motivo>`: un 200 no garantiza la entrega. */
export interface FollowUpSendResult {
  phone: string;
  message_status: string;
}
