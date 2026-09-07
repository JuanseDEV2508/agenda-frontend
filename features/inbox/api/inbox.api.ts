import { apiClient } from "@/lib/api/client";

import type {
  AssignmentResult,
  ConversationDetail,
  ConversationFilter,
  InboxConversation,
  SendMessageResult,
} from "../types";

/** Acceso al chat. Los cursores son IDs enteros de mensaje, nunca UUID. */
export async function fetchConversations(
  { filter = "all", advisor }: { filter?: ConversationFilter; advisor?: string } = {},
  signal?: AbortSignal,
) {
  // El backend envuelve la lista en `{conversations: [...]}`.
  const data = await apiClient.get<{ conversations: InboxConversation[] }>("inbox/conversations", {
    searchParams: { filter, advisor },
    signal,
  });
  return data.conversations ?? [];
}

/** Conversación, contacto y últimos 100 mensajes. Efecto: pone `unread_count` a 0. */
export function fetchConversation(conversationId: string, signal?: AbortSignal) {
  return apiClient.get<ConversationDetail>(`inbox/conversations/${conversationId}`, { signal });
}

export function sendAdvisorMessage(conversationId: string, content: string) {
  return apiClient.post<SendMessageResult>(`inbox/conversations/${conversationId}/messages`, { body: { content } });
}

/** Toma la conversación (apaga el chatbot y la asigna). Con `advisorId`, reasigna. */
export function claimConversation(conversationId: string, advisorId?: string) {
  return apiClient.post<AssignmentResult>(`inbox/conversations/${conversationId}/claim`, {
    body: advisorId ? { advisor_id: advisorId } : {},
  });
}

export function releaseConversation(conversationId: string) {
  return apiClient.post<AssignmentResult>(`inbox/conversations/${conversationId}/release`, { body: {} });
}
