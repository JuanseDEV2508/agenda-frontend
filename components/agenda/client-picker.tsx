"use client";

import * as Popover from "@radix-ui/react-popover";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Search, UserPlus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, InlineAlert } from "@/components/ui/feedback";
import { queryKeys } from "@/config/query-keys";
import { createClient } from "@/features/agenda/api/clients.api";
import { useClientSearch } from "@/features/agenda/hooks/use-clients";
import type { Client } from "@/features/agenda/types";
import { useSession } from "@/features/auth/hooks/use-session";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { canManageClients } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

/**
 * Selector de cliente con búsqueda contra `GET /clients/`.
 *
 * No se cargan todos los clientes: se consulta con el término escrito (debounce)
 * y se muestran los resultados de la página devuelta por el backend.
 */
export function ClientPicker({
  value,
  selectedClient,
  onSelect,
  disabled,
  error,
}: {
  value: string;
  selectedClient: Client | null;
  onSelect: (client: Client | null) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const { user } = useSession();
  const [isOpen, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [isCreating, setCreating] = useState(false);

  const { clients, isLoading, isTyping, isError, error: searchError } = useClientSearch(
    term,
    isOpen && !isCreating,
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Popover.Root
          open={isOpen}
          onOpenChange={(open) => {
            setOpen(open);
            if (!open) setCreating(false);
          }}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-[var(--surface)] px-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:disabled:bg-zinc-800",
                error && "border-rose-500",
              )}
            >
              <span
                className={cn(
                  "min-w-0 truncate",
                  selectedClient
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-400 dark:text-zinc-500",
                )}
              >
                {selectedClient
                  ? [selectedClient.name, selectedClient.phone].filter(Boolean).join(" · ")
                  : "Buscar cliente…"}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-2 shadow-lg"
            >
              {isCreating ? (
                <QuickCreateClient
                  onCancel={() => setCreating(false)}
                  onCreated={(client) => {
                    onSelect(client);
                    setCreating(false);
                    setOpen(false);
                  }}
                />
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                      aria-hidden="true"
                    />
                    <Input
                      autoFocus
                      value={term}
                      onChange={(event) => setTerm(event.target.value)}
                      placeholder="Nombre, teléfono o correo"
                      className="pl-9"
                      aria-label="Buscar cliente"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {isLoading || isTyping ? (
                      <p className="flex items-center gap-2 px-2 py-3 text-sm text-[var(--text-muted)]">
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        Buscando clientes…
                      </p>
                    ) : isError ? (
                      <InlineAlert variant="error">{getErrorMessage(searchError)}</InlineAlert>
                    ) : clients.length === 0 ? (
                      <EmptyState
                        title="Sin resultados"
                        description="No encontramos clientes con ese criterio."
                        className="border-0 py-6"
                      />
                    ) : (
                      <ul className="space-y-0.5">
                        {clients.map((client) => (
                          <li key={client.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onSelect(client);
                                setOpen(false);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <Check
                                className={cn(
                                  "size-4 shrink-0",
                                  value === client.id ? "opacity-100" : "opacity-0",
                                )}
                                aria-hidden="true"
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-zinc-900 dark:text-zinc-50">
                                  {client.name}
                                </span>
                                {client.phone || client.email ? (
                                  <span className="block truncate text-xs text-[var(--text-muted)]">
                                    {[client.phone, client.email].filter(Boolean).join(" · ")}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* El alta rápida requiere la capacidad `manage_clients`. */}
                  {canManageClients(user) ? (
                    <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setCreating(true)}
                      >
                        <UserPlus className="size-4" aria-hidden="true" />
                        Crear cliente rápido
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {selectedClient ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSelect(null)}
            aria-label="Quitar cliente seleccionado"
            disabled={disabled}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Alta mínima de cliente usando el payload documentado de `POST /clients/`. */
function QuickCreateClient({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (client: Client) => void;
}) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit() {
    setFormError(null);
    setFieldErrors({});

    if (!firstName.trim() || !phone.trim()) {
      setFieldErrors({
        ...(firstName.trim() ? {} : { first_name: "El nombre es obligatorio." }),
        ...(phone.trim() ? {} : { phone: "El teléfono es obligatorio." }),
      });
      return;
    }

    setSubmitting(true);
    try {
      const client = await createClient({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        source: "MANUAL",
      });

      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      onCreated(client);
    } catch (error) {
      if (isApiError(error)) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          mapped[field] = messages[0];
        }
        setFieldErrors(mapped);
        setFormError(error.message);
      } else {
        setFormError(getErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 p-1">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Nuevo cliente</p>

      {formError ? <InlineAlert variant="error">{formError}</InlineAlert> : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="qc-first-name" required error={fieldErrors.first_name}>
          <Input
            id="qc-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Apellido" htmlFor="qc-last-name" error={fieldErrors.last_name}>
          <Input
            id="qc-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Teléfono" htmlFor="qc-phone" required error={fieldErrors.phone}>
        <Input
          id="qc-phone"
          type="tel"
          inputMode="tel"
          placeholder="+573001234567"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>

      <Field label="Correo electrónico" htmlFor="qc-email" error={fieldErrors.email}>
        <Input
          id="qc-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => void submit()} isLoading={isSubmitting}>
          Crear y seleccionar
        </Button>
      </div>
    </div>
  );
}
