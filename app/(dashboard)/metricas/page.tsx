import type { Metadata } from "next";
import { MetricsDashboard } from "@/components/metrics/metrics-dashboard";

export const metadata: Metadata = { title: "Métricas" };

export default function MetricsPage() { return <MetricsDashboard />; }
