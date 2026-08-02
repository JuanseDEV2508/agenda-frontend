"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/config/query-keys";
import { searchClients } from "@/features/agenda/api/clients.api";

import { useDebouncedValue } from "./use-debounced-value";

/**
 * Búsqueda de clientes con debounce. No se cargan todos los clientes: se
 * consulta la página que devuelve el backend para el término buscado.
 */
export function useClientSearch(term: string, enabled = true) {
  const debouncedTerm = useDebouncedValue(term, 350);

  const query = useQuery({
    queryKey: queryKeys.clients.search(debouncedTerm.trim()),
    queryFn: ({ signal }) => searchClients(debouncedTerm, signal),
    enabled,
    staleTime: 60_000,
  });

  return {
    clients: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    /** `true` mientras el usuario escribe y aún no se ha lanzado la consulta. */
    isTyping: term !== debouncedTerm,
  };
}
