export type ConversationFilter = "all" | "me" | "unassigned" | "bot";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed" | string;

export interface InboxContact { id: string; name: string; phone_number: string; chatbot_enabled: boolean }
export interface InboxMessage { id: number; content: string; direction: "inbound" | "outbound"; sender_type: "contact" | "bot" | "agent"; status: MessageStatus; created_at: string; ycloud_ok?: boolean }
export interface InboxConversation { id: string; contact: InboxContact; assignment: "unassigned" | "me" | "bot"; status: "open" | "pending" | "resolved"; unread_count: number; last_message_at: string | null; last_message?: InboxMessage }
export interface ConversationDetail { conversation: InboxConversation; contact: InboxContact; messages: InboxMessage[] }
export interface MessagePage { messages: InboxMessage[] }
export interface SendMessageResult { message: InboxMessage; ycloud_ok: boolean }
