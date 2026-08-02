"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { NEXT_PARAM, routes } from "@/config/routes";
import {
  logout as logoutRequest,
  refreshSession,
} from "@/features/auth/api/auth.api";
import type { AuthenticatedUser, CompanySummary, Session } from "@/features/auth/types";
import { SESSION_EXPIRED_EVENT } from "@/lib/api/client";
import { DEFAULT_TIMEZONE } from "@/lib/dates";

interface SessionContextValue {
  user: AuthenticatedUser;
  company: CompanySummary;
  /** Zona horaria de la inmobiliaria: única fuente para formatear fechas. */
  timezone: string;
  isLoggingOut: boolean;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * La sesión llega desde el servidor (layout autenticado), por lo que nunca hay
 * un instante con la interfaz montada y el usuario sin resolver.
 */
export function SessionProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const expiredHandled = useRef(false);

  const clearAndRedirect = useCallback(
    (target: string) => {
      // Evita que datos del usuario anterior sobrevivan a un cambio de sesión.
      queryClient.clear();
      router.replace(target);
      router.refresh();
    },
    [queryClient, router],
  );

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await logoutRequest();
    } catch {
      // Aunque falle la llamada, se limpia el estado local del navegador.
    } finally {
      setIsLoggingOut(false);
      clearAndRedirect(routes.login);
    }
  }, [clearAndRedirect]);

  /*
   * Autorreparación: la sesión se resuelve una sola vez, al iniciar sesión, y
   * queda guardada en la cookie. Si esa foto no trae capacidades —por ejemplo
   * porque se abrió antes de que el backend publicara
   * `GET /users/me/permissions/`— se vuelve a resolver una vez, en el servidor,
   * en lugar de obligar al usuario a cerrar sesión.
   */
  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (session.user.permissions !== null || refreshAttempted.current) return;
    refreshAttempted.current = true;

    void refreshSession()
      .then((refreshed) => {
        // Sólo se recarga si el backend aportó algo nuevo.
        if (refreshed.user.permissions !== null) router.refresh();
      })
      .catch(() => {
        // Si falla se conserva la sesión actual con reglas por rol.
      });
  }, [session.user.permissions, router]);

  useEffect(() => {
    function handleExpired() {
      if (expiredHandled.current) return;
      expiredHandled.current = true;

      toast.error("Tu sesión expiró. Inicia sesión nuevamente.");
      const current = `${window.location.pathname}${window.location.search}`;
      clearAndRedirect(`${routes.login}?${NEXT_PARAM}=${encodeURIComponent(current)}`);
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, [clearAndRedirect]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user: session.user,
      company: session.company,
      timezone: session.company.timezone || DEFAULT_TIMEZONE,
      isLoggingOut,
      logout,
    }),
    [session, isLoggingOut, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>.");
  }
  return context;
}

/** Atajo muy usado: la zona horaria de la empresa. */
export function useTimezone(): string {
  return useSession().timezone;
}
