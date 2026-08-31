"use client";

import { BarChart3, CalendarClock, CalendarDays, LogOut, Menu, MessageCircle, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routes } from "@/config/routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { ROLE_LABELS } from "@/features/auth/types";
import { capitalize, formatEventDate } from "@/lib/dates";
import { canViewMetrics } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: routes.agenda, label: "Agenda", icon: CalendarDays },
  { href: routes.chat, label: "Chat", icon: MessageCircle },
  { href: routes.metrics, label: "Métricas", icon: BarChart3, requiresMetrics: true },
  { href: routes.profile, label: "Mi perfil", icon: UserRound },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Saltar al contenido principal
      </a>

      <Sidebar
        pathname={pathname}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main id="contenido-principal" className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  pathname,
  isMobileOpen,
  onCloseMobile,
}: {
  pathname: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { company, user } = useSession();
  const navItems = NAV_ITEMS.filter(
    (item) => !("requiresMetrics" in item && item.requiresMetrics) || canViewMetrics(user),
  );

  return (
    <>
      {isMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      ) : null}

      <nav
        aria-label="Navegación principal"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)] transition-transform duration-200 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <CalendarClock className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Agenda
              </p>
              <p className="truncate text-xs text-[var(--text-muted)]" title={company.name}>
                {company.name}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onCloseMobile}
            aria-label="Cerrar menú"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <ul className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  // Navegar cierra el menú móvil sin necesidad de un efecto.
                  onClick={onCloseMobile}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-[var(--border-subtle)] p-3">
          <LogoutButton className="w-full justify-start" />
        </div>
      </nav>
    </>
  );
}

function LogoutButton({ className }: { className?: string }) {
  const { logout, isLoggingOut } = useSession();

  return (
    <Button
      variant="ghost"
      className={cn("text-zinc-700 dark:text-zinc-300", className)}
      onClick={() => void logout()}
      isLoading={isLoggingOut}
    >
      {!isLoggingOut ? <LogOut className="size-4" aria-hidden="true" /> : null}
      Cerrar sesión
    </Button>
  );
}

function AppHeader({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = usePathname();
  const { user, company, timezone, logout, isLoggingOut } = useSession();

  // Del propio menú: añadir una sección no obliga a tocar otro sitio.
  const sectionTitle = NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label ?? "Agenda";
  const todayLabel = capitalize(formatEventDate(new Date(), timezone));

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Abrir menú de navegación"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {sectionTitle}
          </h1>
          <p className="hidden truncate text-xs text-[var(--text-muted)] sm:block">
            {todayLabel}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Menú de perfil"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100">
                {getInitials(user.fullName)}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-40 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {user.fullName}
                </span>
                <span className="block text-xs text-[var(--text-muted)]">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuLabel>
              <span className="block truncate font-medium text-zinc-900 dark:text-zinc-50">
                {user.fullName}
              </span>
              <span className="block truncate">{user.email}</span>
              <span className="mt-0.5 block truncate">
                {ROLE_LABELS[user.role]} · {company.name}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={routes.profile}>
                <UserRound className="size-4" aria-hidden="true" />
                Mi perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              disabled={isLoggingOut}
              onSelect={(event) => {
                event.preventDefault();
                void logout();
              }}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
