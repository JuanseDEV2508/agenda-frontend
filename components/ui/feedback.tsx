"use client";

import { AlertTriangle, CalendarX2, Info, Loader2, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";

import { API_ERROR_KIND, isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";

import { Button } from "./button";

/** Estados de interfaz reutilizables: carga, vacío, error, sin permisos. */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800", className)}
      aria-hidden="true"
    />
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
      <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" />
      {label ? <span>{label}</span> : null}
      <span className="sr-only">Cargando</span>
    </span>
  );
}

export function EmptyState({
  icon: Icon = CalendarX2,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-8 text-zinc-400" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function InlineAlert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: "info" | "warning" | "error";
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: {
      box: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-100",
      Icon: Info,
    },
    warning: {
      box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
      Icon: AlertTriangle,
    },
    error: {
      box: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100",
      Icon: AlertTriangle,
    },
  }[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-lg border p-3 text-sm", styles.box, className)}
    >
      <styles.Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-sm/relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

/**
 * Presenta cualquier error de la aplicación con un mensaje útil (nunca
 * "Request failed with status code 400") y una acción de reintento.
 */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const apiError = isApiError(error) ? error : null;

  const Icon =
    apiError?.kind === API_ERROR_KIND.FORBIDDEN
      ? ShieldAlert
      : apiError?.kind === API_ERROR_KIND.NETWORK
        ? WifiOff
        : AlertTriangle;

  const title =
    apiError?.kind === API_ERROR_KIND.FORBIDDEN
      ? "No tienes permisos"
      : apiError?.kind === API_ERROR_KIND.NOT_FOUND
        ? "No encontrado"
        : apiError?.kind === API_ERROR_KIND.NETWORK
          ? "Sin conexión con el servidor"
          : "Ocurrió un error";

  const message =
    apiError?.message ??
    (error instanceof Error ? error.message : "Ocurrió un error inesperado.");

  // Reintentar un 403 no aporta nada; sí lo hace en errores de red o de servidor.
  const canRetry =
    onRetry !== undefined &&
    apiError?.kind !== API_ERROR_KIND.FORBIDDEN &&
    apiError?.kind !== API_ERROR_KIND.NOT_FOUND;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-10 text-center",
        className,
      )}
    >
      <Icon className="size-8 text-rose-500" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
        <p className="mx-auto max-w-md text-sm text-[var(--text-muted)]">{message}</p>
      </div>
      {canRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}
