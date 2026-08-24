export type DashboardPeriod = "7d" | "14d" | "30d" | "90d" | "mtd" | "ytd";

export interface ResolvedPeriod {
  start: string;
  end: string;
  granularity: "hour" | "day" | "week" | "month";
  timezone: string;
  label: string;
}

export interface Trend { current: number; previous: number; change: number; change_pct: number | null }
export interface AgendaTotals {
  date_field: string; total: number; closed: number; completed?: number; cancelled?: number; no_show?: number;
  completion_rate_pct: number; cancellation_rate_pct: number; no_show_rate_pct: number;
  from_chatbot: number; chatbot_share_pct: number; avg_duration_minutes: number | null;
  by_status: Record<string, number>; trend?: Record<string, Trend>;
}
export interface Overview {
  period: ResolvedPeriod; comparison_period: ResolvedPeriod; agenda: AgendaTotals | null;
  inbox: { messages: { total: number; inbound: number; outbound: number; bot_share_pct: number; failure_rate_pct: number }; conversations: { total?: number }; contacts: { total?: number }; response_times?: { overall?: ResponseTime }; trend?: Record<string, Trend> } | null;
}
export interface SeriesPoint { bucket: string; total: number; inbound?: number; outbound?: number; completed?: number; cancelled?: number; no_show?: number; from_chatbot?: number; bot?: number; agent?: number; contact?: number }
export interface EventsDashboard { period: ResolvedPeriod; totals: AgendaTotals; series: SeriesPoint[]; breakdowns: { by_type: Breakdown[]; by_source: Breakdown[]; by_no_show_type: Breakdown[] } }
export interface Breakdown { total: number; share_pct: number; event_type?: string; source?: string; no_show_type?: string }
export interface MessagesDashboard { period: ResolvedPeriod; totals: { total: number; inbound: number; outbound: number; from_bot: number; from_agent: number; failed: number; bot_share_pct: number; failure_rate_pct: number }; series: SeriesPoint[]; by_status: { status: string; total: number; share_pct: number }[] }
export interface HeatmapDashboard { heatmap: { matrix: number[][]; peak: { weekday: number; hour: number; count: number }; weekday_labels: string[] } }
export interface ResponseTime { samples: number; avg: number | null; min?: number | null; p50?: number | null; p90?: number | null; max?: number | null }
export interface ConversationsDashboard { conversations: { new: number; active: number; current: { total: number; by_status: Record<string, number>; unread_conversations: number; resolution_rate_pct: number } }; contacts: { total: number; new: number; active: number; chatbot_enabled: number; chatbot_disabled: number; linked_to_client: number; linked_rate_pct: number }; response_times: { overall: ResponseTime; first_response: ResponseTime; by_sender: { bot: ResponseTime; agent: ResponseTime }; unanswered_conversations: number; truncated: boolean }; automation: { conversations_with_reply: number; bot_only: number; agent_only: number; handoff_conversations: number; full_automation_rate_pct: number; handoff_rate_pct: number }; top_contacts: { contact_id: string; name: string; phone_number: string; chatbot_enabled: boolean; messages: number; inbound: number; outbound: number }[] }
export interface AdvisorMetric { advisor_id: string; code: string; name: string; email: string; total: number; pending: number; confirmed: number; completed: number; cancelled: number; no_show: number; from_chatbot: number; completion_rate_pct: number; no_show_rate_pct: number }
export interface AdvisorsDashboard { advisors: AdvisorMetric[] }
export interface FunnelDashboard { funnel: { steps: { key: string; label: string; value: number; conversion_from_previous_pct: number | null }[]; overall_conversion_pct: number | null } }
