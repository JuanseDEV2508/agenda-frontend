"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryKeys } from "@/config/query-keys";
import { fetchAdvisors } from "@/features/agenda/api/advisors.api";
import type { Advisor } from "@/features/agenda/types";
import { useSession } from "@/features/auth/hooks/use-session";
import { canSelectAdvisor } from "@/lib/permissions";

/**
 * Asesores que el usuario puede consultar.
 *
 * Un ADVISOR no necesita el listado: sólo ve su propia agenda, así que ni
 * siquiera se lanza la petición (§10). Para ADMIN y SUPERVISOR el alcance real
 * lo define el backend en `GET /advisors/`; el frontend no lo amplía.
 */
export function useAdvisors() {
  const { user } = useSession();
  const enabled = canSelectAdvisor(user);

  const query = useQuery({
    queryKey: queryKeys.advisors.list(),
    queryFn: ({ signal }) => fetchAdvisors(signal),
    enabled,
    staleTime: 5 * 60_000,
  });

  const advisors = useMemo<Advisor[]>(() => query.data ?? [], [query.data]);

  return {
    advisors,
    isEnabled: enabled,
    isLoading: enabled && query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

/** Nombre legible de un asesor, evitando mostrar UUID técnicos. */
export function advisorLabel(advisor: Advisor): string {
  return advisor.code ? `${advisor.name} · ${advisor.code}` : advisor.name;
}
