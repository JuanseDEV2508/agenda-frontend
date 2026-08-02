import type { Metadata } from "next";
import { Suspense } from "react";

import { AgendaView } from "@/components/agenda/agenda-view";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Agenda",
};

export default function AgendaPage() {
  return (
    // `useSearchParams` (estado de la agenda en la URL) requiere un límite de Suspense.
    <Suspense fallback={<AgendaFallback />}>
      <AgendaView />
    </Suspense>
  );
}

function AgendaFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando agenda">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
