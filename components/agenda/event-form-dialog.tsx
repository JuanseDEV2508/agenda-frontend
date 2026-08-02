"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import type { EventWritePayload } from "@/features/agenda/api/events.api";
import { useCreateEvent, useUpdateEvent } from "@/features/agenda/hooks/use-event-mutations";
import type { AgendaEvent } from "@/features/agenda/types";

import { EventForm } from "./event-form";

/**
 * Diálogo de creación y edición.
 *
 * Si hay cambios sin guardar pide confirmación antes de cerrar (§16). Ante un
 * error del backend NO se cierra: los datos escritos se conservan para corregir.
 */
export function EventFormDialog({
  open,
  mode,
  event,
  initialDate,
  initialTime,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  event?: AgendaEvent | null;
  initialDate?: string;
  initialTime?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: (event: AgendaEvent) => void;
}) {
  const createMutation = useCreateEvent();
  const updateMutation = useUpdateEvent();

  const [isDirty, setDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const mutation = mode === "create" ? createMutation : updateMutation;

  const close = useCallback(() => {
    setDirty(false);
    createMutation.reset();
    updateMutation.reset();
    onOpenChange(false);
  }, [createMutation, updateMutation, onOpenChange]);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    close();
  }, [isDirty, close]);

  function handleSubmit(payload: EventWritePayload | Partial<EventWritePayload>) {
    if (mode === "create") {
      createMutation.mutate(payload as EventWritePayload, {
        onSuccess: (created) => {
          onSaved?.(created);
          close();
        },
      });
      return;
    }

    if (!event) return;

    // Sin cambios reales: no se molesta al backend.
    if (Object.keys(payload).length === 0) {
      close();
      return;
    }

    updateMutation.mutate(
      { eventId: event.id, payload },
      {
        onSuccess: (updated) => {
          onSaved?.(updated);
          close();
        },
      },
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
          else onOpenChange(true);
        }}
      >
        <DialogContent
          size="lg"
          onInteractOutside={(interactionEvent) => {
            // Con cambios sin guardar, un clic fuera no descarta el trabajo.
            if (isDirty) interactionEvent.preventDefault();
          }}
          onEscapeKeyDown={(keyEvent) => {
            if (isDirty) {
              keyEvent.preventDefault();
              setShowDiscardConfirm(true);
            }
          }}
        >
          <DialogHeader
            title={mode === "create" ? "Crear evento" : "Editar evento"}
            description={
              mode === "create"
                ? "Los horarios se validan contra la agenda del asesor."
                : "Sólo se enviarán los campos que modifiques."
            }
          />

          <DialogBody>
            <EventForm
              mode={mode}
              event={event}
              initialDate={initialDate}
              initialTime={initialTime}
              isSubmitting={mutation.isPending}
              submitError={mutation.error}
              onDirtyChange={setDirty}
              onCancel={requestClose}
              onSubmit={handleSubmit}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent size="sm">
          <DialogHeader
            title="¿Descartar los cambios?"
            description="Se perderá la información que escribiste en el formulario."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDiscardConfirm(false)}>
              Seguir editando
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowDiscardConfirm(false);
                close();
              }}
            >
              Descartar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
