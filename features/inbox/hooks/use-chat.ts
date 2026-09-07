"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryKeys } from "@/config/query-keys";

import { fetchConversation, fetchConversations } from "../api/inbox.api";
import type { ConversationFilter } from "../types";

/** Cada cuánto se refresca. No hay WebSocket: el backend difunde en un no-op. */
const LIST_POLL_MS = 15_000;
const THREAD_POLL_MS = 8_000;

export function useConversations(filters: { filter?: ConversationFilter; advisor?: string } = {}) {
  const query = useQuery({
    queryKey: queryKeys.chat.conversations(filters),
    queryFn: ({ signal }) => fetchConversations(filters, signal),
    refetchInterval: LIST_POLL_MS,
  });

  return {
    conversations: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Conversación abierta: cabecera, contacto e hilo en una sola petición.
 *
 * El detalle ya trae los últimos 100 mensajes, así que no hace falta una
 * segunda consulta paginada ni fusionar cursores.
 * ponytail: hilo acotado a 100 mensajes; añadir `before_id` si hace falta subir más.
 */
export function useConversation(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.chat.detail(conversationId ?? ""),
    queryFn: ({ signal }) => fetchConversation(conversationId as string, signal),
    enabled: Boolean(conversationId),
    refetchInterval: THREAD_POLL_MS,
  });

  // Abrir el chat pone `unread_count` a 0 en el servidor (R4). Sin esto, el
  // badge de la lista seguiría ahí hasta el siguiente refresco.
  useEffect(() => {
    if (!query.isSuccess) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversationsAll });
  }, [query.isSuccess, conversationId, queryClient]);

  return {
    conversation: query.data?.conversation ?? null,
    contact: query.data?.contact ?? null,
    messages: query.data?.messages ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
