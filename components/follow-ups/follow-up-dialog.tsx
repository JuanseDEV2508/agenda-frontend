"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/feedback";
import { useDecideFollowUp } from "@/features/follow-ups/hooks/use-follow-ups";
import type { FollowUpLead, FollowUpStatus } from "@/features/follow-ups/types";
import { getErrorMessage } from "@/lib/api/errors";

const TITLES: Record<string, string> = {
  DONE: "Marcar como gestionado",
  DISMISSED: "Descartar lead",
  SNOOZED: "Posponer seguimiento",
};

/**
 * Diálogo corto sin react-hook-form: una nota y una fecha no justifican
 * zod ni un resolver. Mismo patrón que las acciones de evento.
 */
export function FollowUpDialog({
  lead,
  action,
  onClose,
}: {
  lead: FollowUpLead | null;
  action: FollowUpStatus | null;
  onClose: () => void;
}) {
  const open = Boolean(lead && action);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="sm">
        <DialogHeader title={action ? TITLES[action] : ""} description={lead?.name} />
        {/* El cuerpo solo se monta mientras está abierto: así el formulario
            arranca limpio sin efectos de reinicio. */}
        {open && lead && action ? <Body lead={lead} action={action} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  lead,
  action,
  onClose,
}: {
  lead: FollowUpLead;
  action: FollowUpStatus;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const decide = useDecideFollowUp();

  const needsDate = action === "SNOOZED";

  function submit() {
    decide.mutate(
      {
        phone: lead.phone,
        status: action,
        // El input da `YYYY-MM-DD`; el backend quiere un instante.
        dueAt: needsDate && dueAt ? new Date(`${dueAt}T09:00`).toISOString() : null,
        notes,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <>
      <DialogBody className="space-y-4">
        {decide.isError ? (
          <InlineAlert variant="error">{getErrorMessage(decide.error)}</InlineAlert>
        ) : null}

        {needsDate ? (
          <Field label="Volver a contactar el" required htmlFor="follow-up-due">
            <Input
              id="follow-up-due"
              type="date"
              value={dueAt}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </Field>
        ) : null}

        <Field label="Notas" htmlFor="follow-up-notes">
          <Textarea
            id="follow-up-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Qué pasó con este lead"
          />
        </Field>
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={decide.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={submit}
          isLoading={decide.isPending}
          disabled={needsDate && !dueAt}
          variant={action === "DISMISSED" ? "danger" : "primary"}
        >
          Confirmar
        </Button>
      </DialogFooter>
    </>
  );
}
