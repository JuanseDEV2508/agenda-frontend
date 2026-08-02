"use client";

import {
  Building2,
  Check,
  Clock,
  LogOut,
  Mail,
  Minus,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/feedback";
import { useSession } from "@/features/auth/hooks/use-session";
import { ROLE_LABELS } from "@/features/auth/types";
import { formatTimezoneLabel } from "@/lib/dates";

/** Capacidades que afectan a este módulo; el resto no se muestra por ruido. */
const AGENDA_CAPABILITIES = [
  { key: "view_all_company_events", label: "Ver la agenda de toda la inmobiliaria" },
  { key: "view_supervised_advisor_events", label: "Ver la agenda de asesores supervisados" },
  { key: "view_own_events", label: "Ver mi propia agenda" },
  { key: "create_events", label: "Crear y editar eventos" },
  { key: "reassign_events", label: "Reasignar eventos a otro asesor" },
  { key: "complete_events", label: "Completar eventos" },
  { key: "cancel_events", label: "Cancelar eventos" },
  { key: "manage_clients", label: "Registrar clientes" },
] as const;

/**
 * Perfil de sólo lectura: el módulo de agenda no gestiona usuarios ni empresa
 * (`PATCH /users/{id}/` y `PATCH /companies/current/` quedan fuera de alcance).
 */
export function ProfileView() {
  const { user, company, timezone, logout, isLoggingOut } = useSession();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100">
            {user.fullName.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {user.fullName}
            </h2>
            <p className="truncate text-sm text-[var(--text-muted)]">{user.email}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Datos de la cuenta
        </h3>

        <dl className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={Mail} label="Correo electrónico" value={user.email} />
          <InfoRow icon={ShieldCheck} label="Rol" value={ROLE_LABELS[user.role]} />
          <InfoRow icon={Building2} label="Inmobiliaria" value={company.name} />
          <InfoRow
            icon={Clock}
            label="Zona horaria de la agenda"
            value={formatTimezoneLabel(timezone)}
          />
          {user.advisorId ? (
            <InfoRow icon={UserRound} label="Perfil" value="Tiene agenda como asesor" />
          ) : null}
        </dl>

        {!user.roleConfirmed ? (
          <InlineAlert variant="warning" title="Rol asignado por defecto" className="mt-4">
            No fue posible confirmar tu rol contra el backend
            (<code>GET /users/me/permissions/</code> no respondió), así que se aplicó el más
            restrictivo. Si necesitas más permisos, contacta al administrador.
          </InlineAlert>
        ) : null}
      </section>

      {user.permissions ? (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Capacidades en la agenda
          </h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Las determina el backend combinando tu rol y la configuración de la inmobiliaria.
          </p>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {AGENDA_CAPABILITIES.map(({ key, label }) => (
              <li key={key} className="flex items-center gap-2 text-sm">
                {user.permissions?.[key] ? (
                  <Check
                    className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Minus className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
                )}
                <span
                  className={
                    user.permissions?.[key]
                      ? "text-zinc-900 dark:text-zinc-50"
                      : "text-[var(--text-muted)]"
                  }
                >
                  {label}
                </span>
                <span className="sr-only">
                  {user.permissions?.[key] ? ": permitido" : ": no permitido"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Sesión</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Al cerrar sesión se elimina la sesión de este dispositivo y se limpian los datos
          almacenados en el navegador.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => void logout()}
          isLoading={isLoggingOut}
        >
          {!isLoggingOut ? <LogOut className="size-4" aria-hidden="true" /> : null}
          Cerrar sesión
        </Button>
      </section>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
        <dd className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {value}
        </dd>
      </div>
    </div>
  );
}
