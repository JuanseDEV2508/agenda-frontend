"use client";

import { MessageCircle } from "lucide-react";

import type { InboxConversation } from "@/features/inbox/types";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils/cn";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  showAdvisor,
  timeZone,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  conversations: InboxConversation[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  showAdvisor: boolean;
  timeZone: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-3" aria-busy="true" aria-label="Cargando conversaciones">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isError) return <ErrorState error={error} onRetry={onRetry} className="m-3" />;

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Sin conversaciones"
        description="Aquí aparecerán los chats de WhatsApp que tengas asignados."
        className="m-3"
      />
    );
  }

  return (
    <ul className="divide-y divide-[var(--border-subtle)]">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <button
            type="button"
            onClick={() => onSelect(conversation.id)}
            aria-current={conversation.id === selectedId}
            className={cn(
              "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
              conversation.id === selectedId && "bg-zinc-100 dark:bg-zinc-800",
            )}
          >
            <Avatar contact={conversation.contact} />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {conversation.contact.name || conversation.contact.phone_number}
                </p>
                {conversation.last_activity_at ? (
                  <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                    {formatShortDate(conversation.last_activity_at, timeZone)}
                  </span>
                ) : null}
              </div>

              <p className="truncate text-sm text-[var(--text-muted)]">
                {conversation.last_message_preview || "Sin mensajes"}
              </p>

              <div className="mt-1 flex items-center gap-2">
                {conversation.contact.chatbot_enabled ? (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    Asistente
                  </span>
                ) : null}
                {showAdvisor ? (
                  <span className="truncate text-[11px] text-[var(--text-muted)]">
                    {conversation.advisor?.full_name ?? "Sin asignar"}
                  </span>
                ) : null}
              </div>
            </div>

            {conversation.unread_count > 0 ? (
              <span
                className="mt-1 shrink-0 rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-medium text-white"
                aria-label={`${conversation.unread_count} mensajes sin leer`}
              >
                {conversation.unread_count}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** El backend ya envía inicial y color; no hace falta un componente Avatar. */
function Avatar({ contact }: { contact: InboxConversation["contact"] }) {
  const initial = contact.avatar_initial || (contact.name || contact.phone_number).charAt(0).toUpperCase();

  return (
    <span
      className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
      style={{ backgroundColor: contact.avatar_color || "#71717a" }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
