import { apiClient } from "@/lib/api/client";
import type { AdvisorsDashboard, ConversationsDashboard, DashboardPeriod, EventsDashboard, FunnelDashboard, HeatmapDashboard, MessagesDashboard, Overview } from "../types";

const params = (period: DashboardPeriod, timezone?: string) => ({ period, tz: timezone });

export const fetchOverview = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => apiClient.get<Overview>("dashboard/overview", { searchParams: params(period, timezone), signal });
export const fetchEventsMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => apiClient.get<EventsDashboard>("dashboard/events", { searchParams: params(period, timezone), signal });
export const fetchAdvisorsMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => apiClient.get<AdvisorsDashboard>("dashboard/advisors", { searchParams: params(period, timezone), signal });
export const fetchMessagesMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => apiClient.get<MessagesDashboard>("dashboard/messages", { searchParams: params(period, timezone), signal });
export const fetchHeatmapMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => apiClient.get<HeatmapDashboard>("dashboard/messages/heatmap", { searchParams: params(period, timezone), signal });
export const fetchConversationsMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => apiClient.get<ConversationsDashboard>("dashboard/conversations", { searchParams: { ...params(period, timezone), limit: 10 }, signal });
export const fetchFunnelMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => apiClient.get<FunnelDashboard>("dashboard/funnel", { searchParams: params(period, timezone), signal });
