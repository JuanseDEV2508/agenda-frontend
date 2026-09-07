"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { queryKeys } from "@/config/query-keys";
import { getErrorMessage } from "@/lib/api/errors";

import { claimConversation, releaseConversation, sendAdvisorMessage } from "../api/inbox.api";

/**
 * Mutaciones del chat.
 *
 * Sin actualizaciones optimistas: el backend es la autoridad (puede rechazar
 * por el chatbot encendido o por alcance) y pintar un mensaje que luego
 * desaparece confunde más de lo que ayuda.
 */
function useInvalidateChat() {
  const queryClient = useQueryClient();

  return useCallback(
    (conversationId: string) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversationsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.detail(conversationId) });
    },
    [queryClient],
  );
}

export function useSendMessage(conversationId: string) {
  const invalidate = useInvalidateChat();

  return useMutation({
    mutationFn: (content: string) => sendAdvisorMessage(conversationId, content),
    onSuccess: (result) => {
      invalidate(conversationId);
      // El backend responde 201 aunque WhatsApp rechace el envío (R6): el
      // mensaje queda guardado y marcado como fallido en el hilo.
      if (!result.ycloud_ok) {
        toast.warning("El mensaje se guardó, pero WhatsApp no lo entregó.");
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useClaimConversation(conversationId: string) {
  const invalidate = useInvalidateChat();

  return useMutation({
    mutationFn: (advisorId?: string) => claimConversation(conversationId, advisorId),
    onSuccess: (_result, advisorId) => {
      invalidate(conversationId);
      toast.success(advisorId ? "Conversación reasignada." : "Conversación tomada. Ya puedes responder.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useReleaseConversation(conversationId: string) {
  const invalidate = useInvalidateChat();

  return useMutation({
    mutationFn: () => releaseConversation(conversationId),
    onSuccess: () => {
      invalidate(conversationId);
      toast.success("Conversación devuelta al asistente.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
