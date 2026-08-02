"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/feedback";
import {
  CANCELLATION_SOURCE_LABELS,
  NO_SHOW_TYPE_LABELS,
} from "@/features/agenda/constants";
import { advisorLabel, useAdvisors } from "@/features/agenda/hooks/use-advisors";
import {
  useCancelEvent,
  useCompleteEvent,
  useMarkNoShow,
  useReassignEvent,
  useRescheduleEvent,
} from "@/features/agenda/hooks/use-event-mutations";
import {
  CANCELLATION_SOURCES,
  NO_SHOW_TYPES,
  type AgendaEvent,
  type CancellationSource,
  type NoShowType,
} from "@/features/agenda/types";
import { useSession } from "@/features/auth/hooks/use-session";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import {
  addMinutesToTime,
  durationInMinutes,
  formatDuration,
  formatEventDate,
  formatEventTimeRange,
  formatTimezoneLabel,
  shiftCalendarDate,
  splitApiDateTime,
  toApiDateTime,
} from "@/lib/dates";
import { canReassignEvent } from "@/lib/permissions";

/**
 * Diálogos de las acciones que requieren datos o confirmación explícita.
 * Nunca se usa `window.confirm`: todos son modales accesibles (§17.4).
 *
 * El contenido de cada diálogo vive en un componente interno que sólo se monta
 * mientras está abierto: así el formulario arranca limpio en cada apertura sin
 * necesidad de efectos de reinicio.
 */

interface DialogProps {
  event: AgendaEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* -------------------------------- Completar -------------------------------- */

export function CompleteEventDialog({ event, open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <CompleteBody event={event} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function CompleteBody({ event, onClose }: { event: AgendaEvent; onClose: () => void }) {
  const [notes, setNotes] = useState("");
  const mutation = useCompleteEvent();

  return (
    <DialogContent size="sm">
      <DialogHeader
        title="Completar evento"
        description="Registra el resultado del evento antes de cerrarlo."
      />
      <DialogBody className="space-y-3">
        {mutation.isError ? (
          <InlineAlert variant="error">{getErrorMessage(mutation.error)}</InlineAlert>
        ) : null}

        <Field
          label="Notas de completado"
          htmlFor="completion-notes"
          description="Opcional. Se envía sólo si escribes algo."
        >
          <Textarea
            id="completion-notes"
            rows={4}
            value={notes}
            onChange={(changeEvent) => setNotes(changeEvent.target.value)}
            placeholder="Resultado de la visita, acuerdos, próximos pasos…"
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          isLoading={mutation.isPending}
          onClick={() =>
            mutation.mutate({ eventId: event.id, notes }, { onSuccess: onClose })
          }
        >
          Marcar como completado
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* --------------------------------- Cancelar -------------------------------- */

export function CancelEventDialog({ event, open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <CancelBody event={event} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function CancelBody({ event, onClose }: { event: AgendaEvent; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [source, setSource] = useState<CancellationSource>("CLIENT");
  const [touched, setTouched] = useState(false);
  const mutation = useCancelEvent();

  const reasonError =
    touched && reason.trim() === "" ? "Indica el motivo de la cancelación." : null;

  return (
    <DialogContent size="sm">
      <DialogHeader
        title="Cancelar evento"
        description="Esta acción cambia el estado del evento y queda registrada en el historial."
      />
      <DialogBody className="space-y-3">
        {mutation.isError ? (
          <InlineAlert variant="error">{getErrorMessage(mutation.error)}</InlineAlert>
        ) : null}

        <InlineAlert variant="warning" title="Confirmación requerida">
          Vas a cancelar <strong>{event.title}</strong>. El cliente y el asesor dejarán de
          tener este espacio reservado.
        </InlineAlert>

        <Field label="Motivo" htmlFor="cancel-reason" required error={reasonError}>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(changeEvent) => setReason(changeEvent.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={Boolean(reasonError)}
            placeholder="Ej.: El cliente no puede asistir"
          />
        </Field>

        <Field label="Origen de la cancelación" htmlFor="cancel-source" required>
          <Select
            id="cancel-source"
            value={source}
            onChange={(changeEvent) =>
              setSource(changeEvent.target.value as CancellationSource)
            }
          >
            {CANCELLATION_SOURCES.map((option) => (
              <option key={option} value={option}>
                {CANCELLATION_SOURCE_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Volver
        </Button>
        <Button
          variant="danger"
          isLoading={mutation.isPending}
          onClick={() => {
            setTouched(true);
            if (reason.trim() === "") return;
            mutation.mutate(
              { eventId: event.id, reason: reason.trim(), cancellationSource: source },
              { onSuccess: onClose },
            );
          }}
        >
          Cancelar evento
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ------------------------------- Inasistencia ------------------------------ */

export function NoShowDialog({ event, open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <NoShowBody event={event} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function NoShowBody({ event, onClose }: { event: AgendaEvent; onClose: () => void }) {
  const [type, setType] = useState<NoShowType>("CLIENT_NO_SHOW");
  const [notes, setNotes] = useState("");
  const mutation = useMarkNoShow();

  return (
    <DialogContent size="sm">
      <DialogHeader
        title="Marcar inasistencia"
        description="Registra quién no asistió al evento."
      />
      <DialogBody className="space-y-3">
        {mutation.isError ? (
          <InlineAlert variant="error">{getErrorMessage(mutation.error)}</InlineAlert>
        ) : null}

        <Field label="Tipo de inasistencia" htmlFor="no-show-type" required>
          <Select
            id="no-show-type"
            value={type}
            onChange={(changeEvent) => setType(changeEvent.target.value as NoShowType)}
          >
            {NO_SHOW_TYPES.map((option) => (
              <option key={option} value={option}>
                {NO_SHOW_TYPE_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Notas" htmlFor="no-show-notes" description="Opcional.">
          <Textarea
            id="no-show-notes"
            rows={3}
            value={notes}
            onChange={(changeEvent) => setNotes(changeEvent.target.value)}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          isLoading={mutation.isPending}
          onClick={() =>
            mutation.mutate(
              { eventId: event.id, noShowType: type, notes },
              { onSuccess: onClose },
            )
          }
        >
          Registrar inasistencia
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ------------------------------- Reprogramar ------------------------------- */

export function RescheduleEventDialog({
  event,
  open,
  onOpenChange,
  onRescheduled,
}: DialogProps & { onRescheduled?: (newEvent: AgendaEvent) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <RescheduleBody
          event={event}
          onClose={() => onOpenChange(false)}
          onRescheduled={onRescheduled}
        />
      ) : null}
    </Dialog>
  );
}

function RescheduleBody({
  event,
  onClose,
  onRescheduled,
}: {
  event: AgendaEvent;
  onClose: () => void;
  onRescheduled?: (newEvent: AgendaEvent) => void;
}) {
  const { user, timezone } = useSession();
  const { advisors, isEnabled: canPickAdvisor } = useAdvisors();
  const mutation = useRescheduleEvent();

  const currentDuration = durationInMinutes(event.startAt, event.endAt) ?? 60;
  const start = splitApiDateTime(event.startAt, timezone);
  const end = splitApiDateTime(event.endAt, timezone);

  const [date, setDate] = useState(start?.date ?? "");
  const [time, setTime] = useState(start?.time ?? "09:00");
  const [endDate, setEndDate] = useState(end?.date ?? start?.date ?? "");
  const [endTime, setEndTime] = useState(
    end?.time ?? addMinutesToTime(start?.time ?? "09:00", currentDuration).time,
  );
  const [advisorId, setAdvisorId] = useState("");

  // Al mover el inicio se conserva la duración original.
  function handleStartChange(nextDate: string, nextTime: string) {
    setDate(nextDate);
    setTime(nextTime);
    const shifted = addMinutesToTime(nextTime, currentDuration);
    setEndTime(shifted.time);
    setEndDate(shifted.dayOffset > 0 ? shiftCalendarDate(nextDate, shifted.dayOffset) : nextDate);
  }

  const startAt = toApiDateTime(date, time, timezone);
  const endAt = toApiDateTime(endDate, endTime, timezone);
  const isRangeValid = Boolean(startAt && endAt && endAt > startAt);
  const isConflict = isApiError(mutation.error) && mutation.error.isScheduleConflict;

  return (
    <DialogContent size="md">
      <DialogHeader
        title="Reprogramar evento"
        description="El evento actual quedará como reprogramado y el backend creará uno nuevo."
      />

      <DialogBody className="space-y-4">
        {mutation.isError ? (
          <InlineAlert
            variant={isConflict ? "warning" : "error"}
            title={isConflict ? "Horario no disponible" : "No fue posible reprogramar"}
          >
            {getErrorMessage(mutation.error)}
          </InlineAlert>
        ) : null}

        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Horario actual</p>
          <p className="text-[var(--text-muted)]">{formatEventDate(event.startAt, timezone)}</p>
          <p className="text-[var(--text-muted)]">
            {formatEventTimeRange(event.startAt, event.endAt, timezone)} ·{" "}
            {formatDuration(currentDuration)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nueva fecha y hora de inicio" htmlFor="reschedule-date" required>
            <div className="flex gap-2">
              <Input
                id="reschedule-date"
                type="date"
                value={date}
                onChange={(changeEvent) => handleStartChange(changeEvent.target.value, time)}
                className="flex-1"
              />
              <Input
                type="time"
                aria-label="Nueva hora de inicio"
                step={300}
                value={time}
                onChange={(changeEvent) => handleStartChange(date, changeEvent.target.value)}
                className="w-32"
              />
            </div>
          </Field>

          <Field
            label="Nueva finalización"
            htmlFor="reschedule-end-date"
            required
            error={!isRangeValid ? "La finalización debe ser posterior al inicio." : null}
          >
            <div className="flex gap-2">
              <Input
                id="reschedule-end-date"
                type="date"
                value={endDate}
                onChange={(changeEvent) => setEndDate(changeEvent.target.value)}
                className="flex-1"
              />
              <Input
                type="time"
                aria-label="Nueva hora de finalización"
                step={300}
                value={endTime}
                onChange={(changeEvent) => setEndTime(changeEvent.target.value)}
                className="w-32"
              />
            </div>
          </Field>
        </div>

        {canReassignEvent(user, event) && canPickAdvisor ? (
          <Field
            label="Asesor"
            htmlFor="reschedule-advisor"
            description="Cambia el asesor sólo si es necesario."
          >
            <Select
              id="reschedule-advisor"
              value={advisorId}
              onChange={(changeEvent) => setAdvisorId(changeEvent.target.value)}
            >
              <option value="">Mantener el asesor actual</option>
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisorLabel(advisor)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <p className="text-xs text-[var(--text-muted)]">
          Zona horaria: {formatTimezoneLabel(timezone)}
        </p>
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          isLoading={mutation.isPending}
          disabled={!isRangeValid}
          onClick={() => {
            if (!startAt || !endAt || !isRangeValid) return;
            mutation.mutate(
              {
                eventId: event.id,
                startAt,
                endAt,
                advisorId: advisorId && advisorId !== event.advisor?.id ? advisorId : null,
              },
              {
                onSuccess: (newEvent) => {
                  onRescheduled?.(newEvent);
                  onClose();
                },
              },
            );
          }}
        >
          Reprogramar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* --------------------------------- Reasignar ------------------------------- */

export function ReassignEventDialog({ event, open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <ReassignBody event={event} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function ReassignBody({ event, onClose }: { event: AgendaEvent; onClose: () => void }) {
  const { advisors } = useAdvisors();
  const [advisorId, setAdvisorId] = useState("");
  const mutation = useReassignEvent();

  const options = advisors.filter((advisor) => advisor.id !== event.advisor?.id);

  return (
    <DialogContent size="sm">
      <DialogHeader
        title="Reasignar evento"
        description="Sólo se listan los asesores dentro de tu alcance."
      />
      <DialogBody className="space-y-3">
        {mutation.isError ? (
          <InlineAlert
            variant={
              isApiError(mutation.error) && mutation.error.isScheduleConflict
                ? "warning"
                : "error"
            }
          >
            {getErrorMessage(mutation.error)}
          </InlineAlert>
        ) : null}

        <p className="text-sm text-[var(--text-muted)]">
          Asesor actual: <strong>{event.advisor?.name || "Sin asignar"}</strong>
        </p>

        <Field label="Nuevo asesor" htmlFor="reassign-advisor" required>
          <Select
            id="reassign-advisor"
            value={advisorId}
            onChange={(changeEvent) => setAdvisorId(changeEvent.target.value)}
          >
            <option value="">Selecciona un asesor</option>
            {options.map((advisor) => (
              <option key={advisor.id} value={advisor.id}>
                {advisorLabel(advisor)}
              </option>
            ))}
          </Select>
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          isLoading={mutation.isPending}
          disabled={advisorId === ""}
          onClick={() =>
            mutation.mutate({ eventId: event.id, advisorId }, { onSuccess: onClose })
          }
        >
          Reasignar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
