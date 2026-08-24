"use client";

import { useQueries } from "@tanstack/react-query";
import { BarChart3, CalendarCheck2, MessageCircle } from "lucide-react";
import { useState } from "react";

import { queryKeys } from "@/config/query-keys";
import { Button } from "@/components/ui/button";
import { ErrorState, InlineAlert, Skeleton } from "@/components/ui/feedback";
import { fetchAdvisorsMetrics, fetchConversationsMetrics, fetchEventsMetrics, fetchFunnelMetrics, fetchHeatmapMetrics, fetchMessagesMetrics, fetchOverview } from "@/features/metrics/api/dashboard.api";
import type { DashboardPeriod, SeriesPoint } from "@/features/metrics/types";
import { useSession } from "@/features/auth/hooks/use-session";
import { canViewInboxMetrics, canViewMetrics } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "7d", label: "7 días" }, { value: "14d", label: "14 días" }, { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" }, { value: "mtd", label: "Este mes" }, { value: "ytd", label: "Este año" },
];

const num = new Intl.NumberFormat("es-CO");
const pct = (value: number | null | undefined) => value == null ? "—" : `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
const minutes = (seconds: number | null | undefined) => seconds == null ? "—" : seconds < 60 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`;

export function MetricsDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const { timezone, user } = useSession();
  const metricsEnabled = canViewMetrics(user);
  const inboxEnabled = canViewInboxMetrics(user);
  const queries = useQueries({ queries: [
    { queryKey: queryKeys.dashboard.overview(period), queryFn: ({ signal }: { signal: AbortSignal }) => fetchOverview(period, timezone, signal), enabled: metricsEnabled },
    { queryKey: queryKeys.dashboard.events(period), queryFn: ({ signal }: { signal: AbortSignal }) => fetchEventsMetrics(period, timezone, signal), enabled: metricsEnabled },
    { queryKey: queryKeys.dashboard.advisors(period), queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdvisorsMetrics(period, timezone, signal), enabled: metricsEnabled },
    { queryKey: queryKeys.dashboard.messages(period), queryFn: ({ signal }: { signal: AbortSignal }) => fetchMessagesMetrics(period, timezone, signal), enabled: metricsEnabled && inboxEnabled },
    { queryKey: queryKeys.dashboard.heatmap(period), queryFn: ({ signal }: { signal: AbortSignal }) => fetchHeatmapMetrics(period, timezone, signal), enabled: metricsEnabled && inboxEnabled },
    { queryKey: queryKeys.dashboard.conversations(period), queryFn: ({ signal }: { signal: AbortSignal }) => fetchConversationsMetrics(period, timezone, signal), enabled: metricsEnabled && inboxEnabled },
    { queryKey: queryKeys.dashboard.funnel(period), queryFn: ({ signal }: { signal: AbortSignal }) => fetchFunnelMetrics(period, timezone, signal), enabled: metricsEnabled && inboxEnabled },
  ] });
  const [overview, events, advisors, messages, heatmap, conversations, funnel] = queries;
  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.isError)?.error;
  const retry = () => queries.forEach((q) => void q.refetch());

  if (!metricsEnabled) return <InlineAlert variant="warning" title="Módulo no disponible">No tienes permisos para consultar indicadores.</InlineAlert>;
  if (isLoading && !overview.data) return <MetricsSkeleton />;
  if (error && !overview.data) return <ErrorState error={error} onRetry={retry} />;
  const agenda = overview.data?.agenda;
  const inbox = overview.data?.inbox;

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-2xl font-bold tracking-tight">Indicadores</h2><p className="text-sm text-[var(--text-muted)]">{overview.data?.period ? `${overview.data.period.start.slice(0, 10)} — ${overview.data.period.end.slice(0, 10)}` : "Rendimiento de tu agenda"}</p></div>
      <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">{PERIODS.map((option) => <Button key={option.value} size="sm" variant={period === option.value ? "primary" : "ghost"} onClick={() => setPeriod(option.value)}>{option.label}</Button>)}</div>
    </div>

    {agenda ? <section className="space-y-3"><SectionTitle icon={CalendarCheck2} title="Agenda" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Eventos" value={num.format(agenda.total)} trend={agenda.trend?.total.change_pct} />
      <Metric label="Completados" value={num.format(agenda.by_status.completed ?? 0)} trend={agenda.trend?.completed.change_pct} />
      <Metric label="Tasa de cierre" value={pct(agenda.completion_rate_pct)} trend={agenda.trend?.completion_rate_pct.change_pct} />
      <Metric label="Agendados por bot" value={num.format(agenda.from_chatbot)} trend={agenda.trend?.from_chatbot.change_pct} />
    </div></section> : null}

    {events.data ? <section className="grid gap-4 xl:grid-cols-3"><Panel className="xl:col-span-2" title="Actividad de eventos"><MiniChart series={events.data.series} /></Panel><Panel title="Origen de las visitas"><Breakdown items={events.data.breakdowns.by_source} /></Panel></section> : null}
    {advisors.data ? <Panel title="Rendimiento por asesor"><div className="overflow-x-auto"><table className="w-full min-w-150 text-left text-sm"><thead className="border-b text-xs uppercase text-[var(--text-muted)]"><tr><th className="p-3">Asesor</th><th className="p-3 text-right">Eventos</th><th className="p-3 text-right">Completados</th><th className="p-3 text-right">Cierre</th><th className="p-3 text-right">No asistió</th></tr></thead><tbody>{advisors.data.advisors.map((advisor) => <tr className="border-b border-[var(--border-subtle)] last:border-0" key={advisor.advisor_id}><td className="p-3 font-medium">{advisor.name}<span className="ml-2 text-xs text-[var(--text-muted)]">{advisor.code}</span></td><td className="p-3 text-right">{num.format(advisor.total)}</td><td className="p-3 text-right">{num.format(advisor.completed)}</td><td className="p-3 text-right">{pct(advisor.completion_rate_pct)}</td><td className="p-3 text-right">{pct(advisor.no_show_rate_pct)}</td></tr>)}</tbody></table></div></Panel> : null}

    {inboxEnabled && inbox ? <section className="space-y-3"><SectionTitle icon={MessageCircle} title="Inbox" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Mensajes" value={num.format(inbox.messages.total)} trend={inbox.trend?.messages_total.change_pct} /><Metric label="Conversaciones" value={num.format(inbox.conversations.total ?? 0)} trend={inbox.trend?.conversations_new.change_pct} /><Metric label="Contactos nuevos" value={num.format(inbox.contacts.total ?? 0)} trend={inbox.trend?.contacts_new.change_pct} /><Metric label="Mensajes del bot" value={pct(inbox.messages.bot_share_pct)} trend={inbox.trend?.bot_share_pct.change_pct} /></div></section> : null}
    {inboxEnabled && messages.data && conversations.data && funnel.data ? <section className="grid gap-4 xl:grid-cols-3"><Panel title="Mensajes en el tiempo"><MiniChart series={messages.data.series} /></Panel><Panel title="Respuesta y atención"><div className="space-y-3"><MetricLine label="Mediana de respuesta" value={minutes(conversations.data.response_times.overall.p50)} /><MetricLine label="Sin responder" value={num.format(conversations.data.response_times.unanswered_conversations)} /><MetricLine label="No leídos ahora" value={num.format(conversations.data.conversations.current.unread_conversations)} />{conversations.data.response_times.truncated ? <InlineAlert variant="warning" title="Muestra parcial">Acota el rango para analizar todos los mensajes.</InlineAlert> : null}</div></Panel><Panel title={`Embudo · ${pct(funnel.data.funnel.overall_conversion_pct)}`}><div className="space-y-3">{funnel.data.funnel.steps.map((step) => <div key={step.key}><div className="flex justify-between text-sm"><span>{step.label}</span><strong>{num.format(step.value)}</strong></div><div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, step.conversion_from_previous_pct ?? 100)}%` }} /></div></div>)}</div></Panel></section> : null}
    {inboxEnabled && heatmap.data ? <Panel title="Cuándo escriben"><Heatmap matrix={heatmap.data.heatmap.matrix} labels={heatmap.data.heatmap.weekday_labels} /><p className="mt-3 text-sm text-[var(--text-muted)]">Pico: {heatmap.data.heatmap.weekday_labels[heatmap.data.heatmap.peak.weekday]} a las {heatmap.data.heatmap.peak.hour}:00 ({heatmap.data.heatmap.peak.count} mensajes).</p></Panel> : null}
    {!inboxEnabled ? <InlineAlert title="Métricas de inbox no disponibles">Tu alcance permite consultar los indicadores de agenda. Las métricas del inbox requieren alcance de empresa.</InlineAlert> : null}
  </div>;
}

function SectionTitle({ icon: Icon, title }: { icon: typeof BarChart3; title: string }) { return <h3 className="flex items-center gap-2 text-lg font-semibold"><Icon className="size-5 text-brand-600" />{title}</h3>; }
function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) { return <section className={cn("rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4", className)}><h3 className="mb-4 text-sm font-semibold">{title}</h3>{children}</section>; }
function Metric({ label, value, trend }: { label: string; value: string; trend?: number | null }) { return <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4"><p className="text-sm text-[var(--text-muted)]">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className={cn("mt-1 text-xs", trend == null ? "text-[var(--text-muted)]" : trend >= 0 ? "text-emerald-600" : "text-rose-600")}>{trend == null ? "— sin base de comparación" : `${trend >= 0 ? "+" : ""}${pct(trend)} vs. periodo anterior`}</p></div>; }
function MetricLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 last:border-0 last:pb-0"><span className="text-sm text-[var(--text-muted)]">{label}</span><strong>{value}</strong></div>; }
function MiniChart({ series }: { series: SeriesPoint[] }) { const max = Math.max(1, ...series.map((point) => point.total)); return <div className="flex h-40 items-end gap-px" aria-label="Serie temporal">{series.map((point) => <div key={point.bucket} className="min-w-1 flex-1 rounded-t bg-brand-500 hover:bg-brand-700" title={`${point.bucket}: ${point.total}`} style={{ height: `${Math.max(2, (point.total / max) * 100)}%` }} />)}</div>; }
function Breakdown({ items }: { items: { total: number; share_pct: number; source?: string; event_type?: string; no_show_type?: string }[] }) { return <div className="space-y-3">{items.map((item) => <div key={item.source ?? item.event_type ?? item.no_show_type ?? "sin-dato"}><div className="flex justify-between text-sm"><span>{item.source ?? item.event_type ?? item.no_show_type ?? "Sin dato"}</span><span>{num.format(item.total)} · {pct(item.share_pct)}</span></div><div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-brand-600" style={{ width: `${item.share_pct}%` }} /></div></div>)}</div>; }
function Heatmap({ matrix, labels }: { matrix: number[][]; labels: string[] }) { const max = Math.max(1, ...matrix.flat()); return <div className="overflow-x-auto"><div className="grid min-w-160 grid-cols-[2rem_repeat(24,1fr)] gap-0.5 text-[10px]">{matrix.map((row, day) => <><span key={`label-${day}`} className="self-center text-[var(--text-muted)]">{labels[day]}</span>{row.map((value, hour) => <span key={`${day}-${hour}`} className="aspect-square rounded-sm" title={`${labels[day]} ${hour}:00: ${value}`} style={{ backgroundColor: `rgb(37 99 235 / ${0.08 + (value / max) * 0.92})` }} />)}</>)}</div></div>; }
function MetricsSkeleton() { return <div className="space-y-6"><Skeleton className="h-16 w-full" /><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-32" key={index} />)}</div><Skeleton className="h-72 w-full" /></div>; }
