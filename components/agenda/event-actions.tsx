"use client";

import {
  CalendarSync,
  CheckCheck,
  CircleCheck,
  CircleX,
  MoreHorizontal,
  PencilLine,
  PlayCircle,
  UserRoundCog,
  UserX,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useConfirmEvent,
  useStartEvent,
} from "@/features/agenda/hooks/use-event-mutations";
import type { AgendaEvent } from "@/features/agenda/types";
import { useSession } from "@/features/auth/hooks/use-session";
import {
  canCancelEvent,
  canCompleteEvent,
  canConfirmEvent,
  canEditEvent,
  canMarkNoShow,
  canReassignEvent,
  canRescheduleEvent,
  canStartEvent,
  hasAnyEventAction,
} from "@/lib/permissions";

import {
  CancelEventDialog,
  CompleteEventDialog,
  NoShowDialog,
  ReassignEventDialog,
  RescheduleEventDialog,
} from "./event-action-dialogs";

/**
 * Acciones disponibles sobre un evento.
 *
 * Sólo se muestran las que permite el estado actual y el rol (§17). Que una
 * acción esté oculta no sustituye a la autorización del backend: un `403` se
 * sigue mostrando como mensaje de permisos.
 */
export function EventActions({
  event,
  onEdit,
  onRescheduled,
  layout = "inline",
}: {
  event: AgendaEvent;
  onEdit?: () => void;
  onRescheduled?: (newEvent: AgendaEvent) => void;
  layout?: "inline" | "compact";
}) {
  const { user } = useSession();

  const confirmMutation = useConfirmEvent();
  const startMutation = useStartEvent();

  const [openDialog, setOpenDialog] = useState<
    "complete" | "cancel" | "no-show" | "reschedule" | "reassign" | null
  >(null);

  if (!hasAnyEventAction(user, event)) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No hay acciones disponibles para este evento en su estado actual.
      </p>
    );
  }

  const showConfirm = canConfirmEvent(user, event);
  const showStart = canStartEvent(user, event);
  const showComplete = canCompleteEvent(user, event);
  const showCancel = canCancelEvent(user, event);
  const showNoShow = canMarkNoShow(user, event);
  const showReschedule = canRescheduleEvent(user, event);
  const showReassign = canReassignEvent(user, event);
  const showEdit = canEditEvent(user, event) && onEdit !== undefined;

  return (
    <>
      <div className={layout === "inline" ? "flex flex-wrap items-center gap-2" : "flex gap-1"}>
        {showConfirm ? (
          <Button
            size="sm"
            isLoading={confirmMutation.isPending}
            onClick={() => confirmMutation.mutate(event.id)}
          >
            <CircleCheck className="size-4" aria-hidden="true" />
            Confirmar
          </Button>
        ) : null}

        {showStart ? (
          <Button
            size="sm"
            isLoading={startMutation.isPending}
            onClick={() => startMutation.mutate(event.id)}
          >
            <PlayCircle className="size-4" aria-hidden="true" />
            Iniciar
          </Button>
        ) : null}

        {showComplete ? (
          <Button size="sm" variant="secondary" onClick={() => setOpenDialog("complete")}>
            <CheckCheck className="size-4" aria-hidden="true" />
            Completar
          </Button>
        ) : null}

        {showEdit ? (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <PencilLine className="size-4" aria-hidden="true" />
            Editar
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Más acciones">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            {showReschedule ? (
              <DropdownMenuItem onSelect={() => setOpenDialog("reschedule")}>
                <CalendarSync className="size-4" aria-hidden="true" />
                Reprogramar
              </DropdownMenuItem>
            ) : null}

            {showReassign ? (
              <DropdownMenuItem onSelect={() => setOpenDialog("reassign")}>
                <UserRoundCog className="size-4" aria-hidden="true" />
                Reasignar asesor
              </DropdownMenuItem>
            ) : null}

            {showNoShow || showCancel ? <DropdownMenuSeparator /> : null}

            {showNoShow ? (
              <DropdownMenuItem destructive onSelect={() => setOpenDialog("no-show")}>
                <UserX className="size-4" aria-hidden="true" />
                Marcar inasistencia
              </DropdownMenuItem>
            ) : null}

            {showCancel ? (
              <DropdownMenuItem destructive onSelect={() => setOpenDialog("cancel")}>
                <CircleX className="size-4" aria-hidden="true" />
                Cancelar evento
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CompleteEventDialog
        event={event}
        open={openDialog === "complete"}
        onOpenChange={(open) => setOpenDialog(open ? "complete" : null)}
      />
      <CancelEventDialog
        event={event}
        open={openDialog === "cancel"}
        onOpenChange={(open) => setOpenDialog(open ? "cancel" : null)}
      />
      <NoShowDialog
        event={event}
        open={openDialog === "no-show"}
        onOpenChange={(open) => setOpenDialog(open ? "no-show" : null)}
      />
      <RescheduleEventDialog
        event={event}
        open={openDialog === "reschedule"}
        onOpenChange={(open) => setOpenDialog(open ? "reschedule" : null)}
        onRescheduled={onRescheduled}
      />
      <ReassignEventDialog
        event={event}
        open={openDialog === "reassign"}
        onOpenChange={(open) => setOpenDialog(open ? "reassign" : null)}
      />
    </>
  );
}
