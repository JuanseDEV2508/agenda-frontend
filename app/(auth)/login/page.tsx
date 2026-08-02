import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-center bg-[var(--surface-muted)] px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <CalendarClock className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Agenda Inmobiliaria
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Coordina visitas, reuniones y llamadas de tu equipo en un solo lugar.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Ingresa a tu cuenta
          </h2>

          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          ¿Problemas para ingresar? Contacta al administrador de tu inmobiliaria.
        </p>
      </div>
    </main>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
