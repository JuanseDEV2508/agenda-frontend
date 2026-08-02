import type { Metadata } from "next";

import { EventDetailPage } from "@/components/agenda/event-detail-page";

export const metadata: Metadata = {
  title: "Detalle del evento",
};

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventDetailPage eventId={id} />;
}
