export type ConversationFilter = "all" | "me" | "unassigned" | "bot";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed" | "received" | string;

export interface InboxContact { id: string; name: string; phone_number: string; chatbot_enabled: boolean; avatar_initial?: string; avatar_color?: string }
/** Dueño de la conversación: quien la ve en su bandeja. `null` = sin asignar. */
export interface ConversationAdvisor { id: string; full_name: string }
export interface InboxMessage { id: number; content: string; direction: "inbound" | "outbound" | "system"; sender_type: "contact" | "bot" | "agent"; status: MessageStatus; created_at: string }
export interface InboxConversation {
  id: string;
  display_id: number | null;
  contact: InboxContact;
  advisor: ConversationAdvisor | null;
  assignment: "unassigned" | "me" | "bot";
  status: "open" | "pending" | "resolved";
  unread_count: number;
  last_message_preview: string;
  last_activity_at: string | null;
}
export interface ConversationDetail { conversation: InboxConversation; contact: InboxContact; messages: InboxMessage[] }
export interface SendMessageResult { message: InboxMessage; conversation: InboxConversation; ycloud_ok: boolean; ycloud_error: string | null }
export interface AssignmentResult { conversation: InboxConversation; contact: InboxContact }
