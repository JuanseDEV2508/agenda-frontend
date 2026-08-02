"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogHeader, SheetContent } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { routes } from "@/config/routes";
import { useEvent } from "@/features/agenda/hooks/use-event";
import type { AgendaEvent } from "@/features/agenda/types";

import { EventActions } from "./event-actions";
import { EventDetail } from "./event-detail";

/**
 * Panel lateral de consulta rápida (§27): el detalle completo vive en
 * `/agenda/eventos/[id]`, accesible desde aquí.
 */
export function EventDetailPanel({
  eventId,
  fallbackEvent,
  open,
  onOpenChange,
  onEdit,
}: {
  eventId: string | null;
  /** Datos ya conocidos del calendario: evitan un panel en blanco mientras carga. */
  fallbackEvent?: AgendaEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (event: AgendaEvent) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useEvent(open ? eventId : null);
  const event = data ?? fallbackEvent ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-label="Detalle del evento">
        <DialogHeader
          title={event?.title ?? "Detalle del evento"}
          description="Consulta rápida del evento seleccionado."
        />

        <DialogBody className="space-y-4">
          {isError && !event ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : !event ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              {isLoading ? (
                <p className="text-xs text-[var(--text-muted)]">Actualizando información…</p>
              ) : null}

              <EventActions
                event={event}
                onEdit={() => onEdit(event)}
                onRescheduled={() => onOpenChange(false)}
              />

              <EventDetail event={event} showHistory={false} />

              <Button variant="outline" className="w-full justify-center" asChild>
                <Link href={routes.eventDetail(event.id)}>
                  Ver detalle completo
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </>
          )}
        </DialogBody>
      </SheetContent>
    </Dialog>
  );
}
