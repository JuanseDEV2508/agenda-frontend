"use client";

import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck2, CalendarDays, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { AgendaList } from "@/components/agenda/agenda-list";
import { EventChip } from "@/components/agenda/event-chip";
import { Metric, Panel, num, pct } from "@/components/metrics/metrics-dashboard";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { queryKeys } from "@/config/query-keys";
import { routes } from "@/config/routes";
import { fetchCalendarWeek } from "@/features/agenda/api/events.api";
import type { AgendaEvent } from "@/features/agenda/types";
import { useSession } from "@/features/auth/hooks/use-session";
import { selectHomeEvents } from "@/features/home/select";
import { fetchAdvisorsMetrics, fetchOverview } from "@/features/metrics/api/dashboard.api";
import type { AdvisorMetric, AgendaTotals, DashboardPeriod } from "@/features/metrics/types";
import {
  capitalize,
  formatEventDate,
  getVisibleRange,
  shiftCalendarDate,
  todayInZone,
  type CalendarDate,
  type VisibleRange,
} from "@/lib/dates";
import { canViewAllAdvisors, isAdmin } from "@/lib/permissions";

/** Ventana de los indicadores. El detalle y el resto de periodos viven en /metricas. */
const PERIOD: DashboardPeriod = "30d";
const UPCOMING_DAYS = 6;

export function HomeView() {
  const router = useRouter();
  const { user, timezone } = useSession();

  const today = todayInZone(timezone);
  const previousWeek = shiftCalendarDate(today, -7);
  const showTeam = canViewAllAdvisors(user);

  const [week, lastWeek, overview, advisors] = useQueries({
    queries: [
      {
        queryKey: queryKeys.calendar.week(today),
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchCalendarWeek(today, signal),
      },
      {
        queryKey: queryKeys.calendar.week(previousWeek),
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchCalendarWeek(previousWeek, signal),
      },
      {
        queryKey: queryKeys.dashboard.overview(PERIOD),
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchOverview(PERIOD, timezone, signal),
      },
      {
        queryKey: queryKeys.dashboard.advisors(PERIOD),
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdvisorsMetrics(PERIOD, timezone, signal),
        enabled: showTeam,
      },
    ],
  });

  const buckets = useMemo(
    () =>
      selectHomeEvents([week.data ?? [], lastWeek.data ?? []], {
        today,
        now: new Date(),
        timezone,
      }),
    [week.data, lastWeek.data, today, timezone],
  );

  const openEvent = (event: AgendaEvent) => router.push(routes.eventDetail(event.id));
  const isLoadingAgenda = week.isLoading || lastWeek.isLoading;
  const agendaError = week.error ?? lastWeek.error;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">
          Hola{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          {capitalize(formatEventDate(new Date(), timezone))}
        </p>
      </header>

      {agendaError ? (
        <ErrorState error={agendaError} onRetry={() => void week.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Mi día">
              {isLoadingAgenda ? (
                <Skeleton className="h-40 w-full" />
              ) : buckets.today.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck2}
                  title="Nada agendado para hoy"
                  description="Cuando tengas citas hoy aparecerán aquí, en orden."
                />
              ) : (
                <AgendaList
                  range={getVisibleRange("day", today)}
                  events={buckets.today}
                  timezone={timezone}
                  today={today}
                  showAdvisor={showTeam}
                  onSelectEvent={openEvent}
                />
              )}
            </Panel>

            <Panel title="Requieren tu atención">
              {isLoadingAgenda ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <PendingLists buckets={buckets} timezone={timezone} onSelect={openEvent} />
              )}
            </Panel>
          </div>

          <section aria-labelledby="mis-numeros" className="space-y-3">
            <h3 id="mis-numeros" className="text-sm font-semibold">
              Mis números · últimos 30 días
            </h3>
            {overview.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-28" />
                ))}
              </div>
            ) : overview.isError ? (
              <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
            ) : (
              <Numbers agenda={overview.data?.agenda ?? null} />
            )}
          </section>

          <Panel title="Próximos días">
            {isLoadingAgenda ? (
              <Skeleton className="h-40 w-full" />
            ) : buckets.upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="La semana está despejada"
                description="No hay nada agendado en los próximos días."
              />
            ) : (
              <AgendaList
                range={upcomingRange(today)}
                events={buckets.upcoming}
                timezone={timezone}
                today={today}
                showAdvisor={showTeam}
                onSelectEvent={openEvent}
              />
            )}
          </Panel>

          {showTeam ? (
            <Panel title={isAdmin(user) ? "Rendimiento de la empresa" : "Mi equipo"}>
              {advisors.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : advisors.isError ? (
                <ErrorState error={advisors.error} onRetry={() => void advisors.refetch()} />
              ) : (
                <TeamList rows={advisors.data?.advisors ?? []} />
              )}
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * `getVisibleRange("week", …)` ancla en lunes; aquí hacen falta los seis días
 * siguientes a hoy, que es justo lo que devuelve `calendar/week`.
 */
function upcomingRange(today: CalendarDate): VisibleRange {
  const days = Array.from({ length: UPCOMING_DAYS }, (_, index) =>
    shiftCalendarDate(today, index + 1),
  );
  return { view: "week", start: days[0], end: days[days.length - 1], days, label: "" };
}

function PendingLists({
  buckets,
  timezone,
  onSelect,
}: {
  buckets: ReturnType<typeof selectHomeEvents>;
  timezone: string;
  onSelect: (event: AgendaEvent) => void;
}) {
  if (buckets.overdue.length === 0 && buckets.toConfirm.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck2}
        title="Todo al día"
        description="No tienes citas sin cerrar ni pendientes de confirmar."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* `variant="block"` y no `row`: en este bloque el estado es el dato. */}
      <PendingGroup
        title="Sin cerrar"
        hint="Ya pasaron y siguen abiertas"
        icon={AlertTriangle}
        events={buckets.overdue}
        timezone={timezone}
        onSelect={onSelect}
      />
      <PendingGroup
        title="Por confirmar"
        hint="Aún sin confirmar con el cliente"
        icon={CalendarCheck2}
        events={buckets.toConfirm}
        timezone={timezone}
        onSelect={onSelect}
      />
    </div>
  );
}

function PendingGroup({
  title,
  hint,
  icon: Icon,
  events,
  timezone,
  onSelect,
}: {
  title: string;
  hint: string;
  icon: typeof AlertTriangle;
  events: AgendaEvent[];
  timezone: string;
  onSelect: (event: AgendaEvent) => void;
}) {
  if (events.length === 0) return null;

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
        <Icon className="size-3.5" aria-hidden />
        {title} · {events.length}
        <span className="sr-only">. {hint}</span>
      </p>
      <ul className="space-y-1.5">
        {events.map((event) => (
          <li key={event.id}>
            <EventChip event={event} timezone={timezone} variant="block" onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Numbers({ agenda: totals }: { agenda: AgendaTotals | null }) {
  if (!totals) {
    return (
      <EmptyState
        icon={CalendarCheck2}
        title="Sin datos en este periodo"
        description="Cuando tengas citas en los últimos 30 días verás aquí tus indicadores."
      />
    );
  }

  // `change_pct` llega `null` si el periodo anterior fue cero: se pinta un
  // guion, nunca una flecha de subida inventada.
  const trend = (key: string) => totals.trend?.[key]?.change_pct ?? null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Citas" value={num.format(totals.total)} trend={trend("total")} />
      <Metric
        label="Completadas"
        value={num.format(totals.completed ?? 0)}
        trend={trend("completed")}
      />
      <Metric
        label="Tasa de cumplimiento"
        value={pct(totals.completion_rate_pct)}
        trend={trend("completion_rate_pct")}
      />
      <Metric label="Inasistencias" value={pct(totals.no_show_rate_pct)} trend={trend("no_show")} />
    </div>
  );
}

function TeamList({ rows }: { rows: AdvisorMetric[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={Users} title="Sin actividad en el periodo" />;
  }

  return (
    <ul className="space-y-2">
      {rows.slice(0, 5).map((row) => (
        <li
          key={row.advisor_id}
          className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-2 text-sm last:border-0 last:pb-0"
        >
          <span className="truncate">{row.name}</span>
          <span className="shrink-0 text-[var(--text-muted)]">
            {num.format(row.completed)}/{num.format(row.total)} · {pct(row.completion_rate_pct)}
          </span>
        </li>
      ))}
    </ul>
  );
}
