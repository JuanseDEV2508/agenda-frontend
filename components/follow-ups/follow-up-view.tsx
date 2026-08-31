"use client";

import { CheckCheck, Clock, Send, UserRoundX, Users } from "lucide-react";
import { useState } from "react";

import { FollowUpDialog } from "@/components/follow-ups/follow-up-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { advisorLabel, useAdvisors } from "@/features/agenda/hooks/use-advisors";
import { useSession } from "@/features/auth/hooks/use-session";
import { useFollowUps, useSendFollowUp } from "@/features/follow-ups/hooks/use-follow-ups";
import type { FollowUpLead, FollowUpReason, FollowUpStatus } from "@/features/follow-ups/types";
import { formatRelativeDays } from "@/lib/dates";
import { canSelectAdvisor } from "@/lib/permissions";

const REASON_LABELS: Record<FollowUpReason, string> = {
  CANCELLED: "Canceló la cita",
  NO_SHOW: "No asistió",
  COMPLETED: "Visitó sin cerrar",
  INACTIVE: "Sin citas",
};

const REASON_STYLES: Record<FollowUpReason, string> = {
  CANCELLED: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  NO_SHOW: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100",
  COMPLETED: "bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-100",
  INACTIVE: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};

export function FollowUpView() {
  const { user, timezone } = useSession();
  const [advisor, setAdvisor] = useState("");
  const [reason, setReason] = useState("");
  const [dialog, setDialog] = useState<{ lead: FollowUpLead; action: FollowUpStatus } | null>(null);

  const showAdvisorFilter = canSelectAdvisor(user);
  const { advisors } = useAdvisors();
  const { leads, isLoading, isError, error, refetch } = useFollowUps({
    advisor: advisor || undefined,
    reason: reason || undefined,
  });

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Seguimiento de leads</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Clientes con los que no se concretó nada y a los que toca volver.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-label="Filtrar por motivo"
          className="h-9 w-auto text-sm"
        >
          <option value="">Todos los motivos</option>
          {Object.entries(REASON_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        {showAdvisorFilter ? (
          <Select
            value={advisor}
            onChange={(event) => setAdvisor(event.target.value)}
            aria-label="Filtrar por asesor"
            className="h-9 w-auto text-sm"
          >
            <option value="">Todos los asesores</option>
            {advisors.map((item) => (
              <option key={item.id} value={item.id}>
                {advisorLabel(item)}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando leads">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay leads pendientes"
          description="Cuando una cita quede sin cerrar o un contacto lleve tiempo sin moverse, aparecerá aquí."
        />
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => (
            <LeadRow
              key={lead.phone}
              lead={lead}
              timeZone={timezone}
              showAdvisor={showAdvisorFilter}
              onAction={(action) => setDialog({ lead, action })}
            />
          ))}
        </ul>
      )}

      <FollowUpDialog
        lead={dialog?.lead ?? null}
        action={dialog?.action ?? null}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function LeadRow({
  lead,
  timeZone,
  showAdvisor,
  onAction,
}: {
  lead: FollowUpLead;
  timeZone: string;
  showAdvisor: boolean;
  onAction: (action: FollowUpStatus) => void;
}) {
  const send = useSendFollowUp();

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{lead.name}</p>
        <p className="truncate text-xs text-[var(--text-muted)]">
          {lead.phone}
          {showAdvisor ? ` · ${lead.advisor?.full_name ?? "sin asesor"}` : ""}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${REASON_STYLES[lead.reason]}`}
          >
            {REASON_LABELS[lead.reason]}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {formatRelativeDays(lead.since, timeZone)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => send.mutate(lead.phone)} isLoading={send.isPending}>
          <Send className="size-4" aria-hidden />
          Enviar
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("SNOOZED")}>
          <Clock className="size-4" aria-hidden />
          Posponer
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("DONE")}>
          <CheckCheck className="size-4" aria-hidden />
          Gestionado
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAction("DISMISSED")}>
          <UserRoundX className="size-4" aria-hidden />
          Descartar
        </Button>
      </div>
    </li>
  );
}
