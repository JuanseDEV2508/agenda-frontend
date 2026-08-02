"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { routes } from "@/config/routes";
import { useEvent } from "@/features/agenda/hooks/use-event";
import type { AgendaEvent } from "@/features/agenda/types";
import { isApiError } from "@/lib/api/errors";

import { EventActions } from "./event-actions";
import { EventDetail } from "./event-detail";
import { EventFormDialog } from "./event-form-dialog";

/** Página completa del evento: detalle amplio, acciones e historial. */
export function EventDetailPage({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { data: event, isLoading, isError, error, refetch } = useEvent(eventId);
  const [isEditing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    const notFound = isApiError(error) && error.isNotFound;

    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink />
        {notFound ? (
          <EmptyState
            title="Evento no encontrado"
            description="El evento no existe o no está dentro de tu alcance."
            action={
              <Button variant="outline" asChild>
                <Link href={routes.agenda}>Volver a la agenda</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink />

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-6">
        <div className="mb-4">
          <EventActions
            event={event}
            onEdit={() => setEditing(true)}
            onRescheduled={(newEvent: AgendaEvent) =>
              router.push(routes.eventDetail(newEvent.id))
            }
          />
        </div>

        <EventDetail event={event} />
      </div>

      <EventFormDialog
        open={isEditing}
        mode="edit"
        event={event}
        onOpenChange={setEditing}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href={routes.agenda}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Volver a la agenda
    </Link>
  );
}
