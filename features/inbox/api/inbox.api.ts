import { apiClient } from "@/lib/api/client";
import type { ConversationDetail, ConversationFilter, InboxConversation, MessagePage, SendMessageResult } from "../types";

/** Acceso al inbox. Los cursores son IDs enteros de mensaje, nunca UUID. */
export function fetchConversations(filter: ConversationFilter = "all", signal?: AbortSignal) {
  return apiClient.get<InboxConversation[]>("inbox/conversations", { searchParams: { filter }, signal });
}

export function fetchConversation(conversationId: string, signal?: AbortSignal) {
  return apiClient.get<ConversationDetail>(`inbox/conversations/${conversationId}`, { signal });
}

export function fetchMessages(conversationId: string, options: { limit?: number; afterId?: number; beforeId?: number; signal?: AbortSignal } = {}) {
  return apiClient.get<MessagePage>(`inbox/conversations/${conversationId}/messages`, { searchParams: { limit: options.limit, after_id: options.afterId, before_id: options.beforeId }, signal: options.signal });
}

export function sendAdvisorMessage(conversationId: string, content: string) {
  return apiClient.post<SendMessageResult>(`inbox/conversations/${conversationId}/messages`, { body: { content } });
}

export function setContactChatbot(contactId: string, enabled: boolean) {
  return apiClient.post(`inbox/contacts/${contactId}/chatbot`, { body: { enabled } });
}

/** Persiste un mensaje sin entregarlo a WhatsApp, para los flujos del chatbot. */
export function saveInboxMessage(body: Record<string, unknown>) {
  return apiClient.post("inbox/messages", { body });
}
