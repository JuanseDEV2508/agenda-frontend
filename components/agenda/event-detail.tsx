"use client";

import {
  Building2,
  CalendarClock,
  ExternalLink,
  History,
  Link2,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Users,
} from "lucide-react";

import { InlineAlert, Skeleton } from "@/components/ui/feedback";
import {
  labelForCancellationSource,
  labelForNoShowType,
} from "@/features/agenda/constants";
import { useEventHistory } from "@/features/agenda/hooks/use-event";
import type { AgendaEvent } from "@/features/agenda/types";
import { useSession } from "@/features/auth/hooks/use-session";
import {
  durationInMinutes,
  formatDateTime,
  formatDuration,
  formatEventDate,
  formatEventTimeRange,
  formatTimezoneLabel,
} from "@/lib/dates";
import { canViewAllAdvisors } from "@/lib/permissions";
import { displayUrl, safeExternalUrl } from "@/lib/utils/url";

import { EventStatusBadge } from "./event-status-badge";
import { EventTypeBadge } from "./event-type-badge";

/**
 * Detalle del evento.
 *
 * Sólo se muestran los campos con valor: nunca filas vacías (§15).
 */
export function EventDetail({
  event,
  showHistory = true,
}: {
  event: AgendaEvent;
  showHistory?: boolean;
}) {
  const { user, timezone } = useSession();
  const duration = durationInMinutes(event.startAt, event.endAt);

  const meetingUrl = safeExternalUrl(event.meetingUrl);
  const propertyUrl = safeExternalUrl(event.propertyUrl);

  const hasPropertyInfo = Boolean(
    event.propertyCode ||
      event.propertyTitle ||
      event.propertyAddress ||
      event.propertyExternalId ||
      propertyUrl,
  );

  const hasOutcomeInfo = Boolean(
    event.completionNotes ||
      event.cancellationReason ||
      event.noShowType ||
      event.noShowNotes ||
      event.rescheduledAt ||
      event.rescheduledToId ||
      event.rescheduledFromId,
  );

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <EventTypeBadge eventType={event.eventType} />
          <EventStatusBadge status={event.status} />
          {event.assignedAutomatically ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Asignado automáticamente
            </span>
          ) : null}
          {event.requiresConfirmation ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Requiere confirmación
            </span>
          ) : null}
        </div>

        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{event.title}</h2>
      </header>

      <Section title="Cuándo" icon={CalendarClock}>
        <Row label="Fecha" value={formatEventDate(event.startAt, timezone)} />
        <Row label="Horario" value={formatEventTimeRange(event.startAt, event.endAt, timezone)} />
        {duration !== null ? <Row label="Duración" value={formatDuration(duration)} /> : null}
        <Row label="Zona horaria" value={formatTimezoneLabel(event.timezone ?? timezone)} />
      </Section>

      {(canViewAllAdvisors(user) && event.advisor) || event.client ? (
        <Section title="Participantes" icon={Users}>
          {event.advisor && canViewAllAdvisors(user) ? (
            <Row
              label="Asesor"
              value={event.advisor.name || "Asignado"}
              icon={UserRound}
            />
          ) : null}

          {event.client ? (
            <>
              <Row label="Cliente" value={event.client.name || "Cliente asignado"} icon={UserRound} />
              {event.client.phone ? (
                <Row label="Teléfono" value={event.client.phone} icon={Phone} />
              ) : null}
              {event.client.email ? (
                <Row label="Correo" value={event.client.email} icon={Mail} />
              ) : null}
            </>
          ) : null}
        </Section>
      ) : null}

      {event.location || meetingUrl ? (
        <Section title="Lugar" icon={MapPin}>
          {event.location ? <Row label="Ubicación" value={event.location} /> : null}
          {meetingUrl ? (
            <Row
              label="Enlace de reunión"
              icon={Link2}
              value={
                <a
                  href={meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand-700 underline underline-offset-2 dark:text-brand-300"
                >
                  {displayUrl(meetingUrl)}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              }
            />
          ) : null}
        </Section>
      ) : null}

      {hasPropertyInfo ? (
        <Section title="Inmueble" icon={Building2}>
          {event.propertyTitle ? <Row label="Nombre" value={event.propertyTitle} /> : null}
          {event.propertyCode ? <Row label="Código" value={event.propertyCode} /> : null}
          {event.propertyExternalId ? (
            <Row label="Identificador externo" value={event.propertyExternalId} />
          ) : null}
          {event.propertyAddress ? (
            <Row label="Dirección" value={event.propertyAddress} />
          ) : null}
          {propertyUrl ? (
            <Row
              label="Ficha del inmueble"
              value={
                <a
                  href={propertyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand-700 underline underline-offset-2 dark:text-brand-300"
                >
                  {displayUrl(propertyUrl)}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              }
            />
          ) : null}
        </Section>
      ) : null}

      {event.description ? (
        <Section title="Descripción">
          <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
            {event.description}
          </p>
        </Section>
      ) : null}

      {hasOutcomeInfo ? (
        <Section title="Resultado">
          {event.completionNotes ? (
            <Row label="Notas de completado" value={event.completionNotes} />
          ) : null}
          {event.cancellationReason ? (
            <Row label="Motivo de cancelación" value={event.cancellationReason} />
          ) : null}
          {event.cancellationSource ? (
            <Row
              label="Origen de la cancelación"
              value={labelForCancellationSource(event.cancellationSource)}
            />
          ) : null}
          {event.cancelledAt ? (
            <Row label="Cancelado el" value={formatDateTime(event.cancelledAt, timezone)} />
          ) : null}
          {event.noShowType ? (
            <Row label="Inasistencia" value={labelForNoShowType(event.noShowType)} />
          ) : null}
          {event.noShowNotes ? <Row label="Notas" value={event.noShowNotes} /> : null}
          {event.rescheduledAt ? (
            <Row label="Reprogramado el" value={formatDateTime(event.rescheduledAt, timezone)} />
          ) : null}
        </Section>
      ) : null}

      <Section title="Registro">
        {event.source ? <Row label="Origen" value={event.source} /> : null}
        {event.createdAt ? (
          <Row label="Creado" value={formatDateTime(event.createdAt, timezone)} />
        ) : null}
        {event.updatedAt ? (
          <Row label="Última actualización" value={formatDateTime(event.updatedAt, timezone)} />
        ) : null}
      </Section>

      {showHistory ? <EventHistorySection eventId={event.id} /> : null}
    </div>
  );
}

function EventHistorySection({ eventId }: { eventId: string }) {
  const { timezone } = useSession();
  const { data, isLoading, isError } = useEventHistory(eventId);

  if (isLoading) {
    return (
      <Section title="Historial" icon={History}>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
      </Section>
    );
  }

  if (isError) {
    return (
      <Section title="Historial" icon={History}>
        <InlineAlert variant="info">
          No fue posible cargar el historial de este evento.
        </InlineAlert>
      </Section>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <Section title="Historial" icon={History}>
      <ol className="space-y-2.5">
        {data.map((entry) => (
          <li key={entry.id} className="flex gap-2.5 text-sm">
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-zinc-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-medium text-zinc-800 dark:text-zinc-100">{entry.action}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {[
                  entry.createdAt ? formatDateTime(entry.createdAt, timezone) : null,
                  entry.actor,
                  entry.source,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {entry.notes ? (
                <p className="mt-0.5 text-xs text-zinc-700 dark:text-zinc-300">{entry.notes}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-3.5">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-muted)] sm:w-44">
        {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
        {label}
      </span>
      <span className="min-w-0 break-words text-sm text-zinc-900 dark:text-zinc-50">
        {value}
      </span>
    </div>
  );
}
