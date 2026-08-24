import { API_DASHBOARD_PREFIX } from "@/config/routes";
import { createApiClient } from "@/lib/api/client";
import type { AdvisorsDashboard, ConversationsDashboard, DashboardPeriod, EventsDashboard, FunnelDashboard, HeatmapDashboard, MessagesDashboard, Overview } from "../types";

const params = (period: DashboardPeriod, timezone?: string) => ({ period, tz: timezone });
const dashboardApiClient = createApiClient(API_DASHBOARD_PREFIX);

export const fetchOverview = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => dashboardApiClient.get<Overview>("overview", { searchParams: params(period, timezone), signal });
export const fetchEventsMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => dashboardApiClient.get<EventsDashboard>("events", { searchParams: params(period, timezone), signal });
export const fetchAdvisorsMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => dashboardApiClient.get<AdvisorsDashboard>("advisors", { searchParams: params(period, timezone), signal });
export const fetchMessagesMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => dashboardApiClient.get<MessagesDashboard>("messages", { searchParams: params(period, timezone), signal });
export const fetchHeatmapMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => dashboardApiClient.get<HeatmapDashboard>("messages/heatmap", { searchParams: params(period, timezone), signal });
export const fetchConversationsMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => dashboardApiClient.get<ConversationsDashboard>("conversations", { searchParams: { ...params(period, timezone), limit: 10 }, signal });
export const fetchFunnelMetrics = (period: DashboardPeriod, timezone?: string, signal?: AbortSignal) => dashboardApiClient.get<FunnelDashboard>("funnel", { searchParams: params(period, timezone), signal });
