"use client";

import { ArrowLeft, Bot, MessageCircle, UserCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MessageBubble } from "@/components/chat/message-bubble";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, Skeleton } from "@/components/ui/feedback";
import { advisorLabel, useAdvisors } from "@/features/agenda/hooks/use-advisors";
import { useSession } from "@/features/auth/hooks/use-session";
import { useConversation } from "@/features/inbox/hooks/use-chat";
import type { InboxContact, InboxConversation, InboxMessage } from "@/features/inbox/types";
import {
  useClaimConversation,
  useReleaseConversation,
  useSendMessage,
} from "@/features/inbox/hooks/use-chat-mutations";

export function ConversationThread({
  conversationId,
  onBack,
}: {
  conversationId: string | null;
  onBack: () => void;
}) {
  const { timezone } = useSession();
  const { conversation, contact, messages, isLoading, isError, error, refetch } =
    useConversation(conversationId);

  if (!conversationId) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Selecciona una conversación"
        description="Elige un chat de la lista para ver el historial y responder."
        className="m-4 border-none"
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true" aria-label="Cargando conversación">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !conversation || !contact) {
    return <ErrorState error={error} onRetry={() => void refetch()} className="m-4" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ThreadHeader conversation={conversation} contact={contact} onBack={onBack} />

      <MessageList messages={messages} timeZone={timezone} />

      <Composer conversationId={conversationId} chatbotEnabled={contact.chatbot_enabled} />
    </div>
  );
}

function ThreadHeader({
  conversation,
  contact,
  onBack,
}: {
  conversation: InboxConversation;
  contact: InboxContact;
  onBack: () => void;
}) {
  const claim = useClaimConversation(conversation.id);
  const release = useReleaseConversation(conversation.id);
  const { advisors, isEnabled: canReassign } = useAdvisors();

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
      <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden" aria-label="Volver">
        <ArrowLeft className="size-4" aria-hidden />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
          {contact.name || contact.phone_number}
        </p>
        <p className="truncate text-xs text-[var(--text-muted)]">
          {contact.phone_number}
          {conversation.advisor ? ` · ${conversation.advisor.full_name}` : " · sin asignar"}
        </p>
      </div>

      {/* Reasignar es la misma acción de tomar, con destino explícito. */}
      {canReassign ? (
        <Select
          value=""
          onChange={(event) => event.target.value && claim.mutate(event.target.value)}
          disabled={claim.isPending}
          aria-label="Reasignar a otro asesor"
          className="h-8 w-auto text-sm"
        >
          <option value="">Reasignar a…</option>
          {advisors
            .filter((advisor) => advisor.id !== conversation.advisor?.id)
            .map((advisor) => (
              <option key={advisor.id} value={advisor.id}>
                {advisorLabel(advisor)}
              </option>
            ))}
        </Select>
      ) : null}

      {/* Una sola acción: responder con el chatbot encendido devuelve 403, así
          que tomar la conversación y apagar el bot van juntos. */}
      {contact.chatbot_enabled ? (
        <Button size="sm" onClick={() => claim.mutate(undefined)} isLoading={claim.isPending}>
          <UserCheck className="size-4" aria-hidden />
          Tomar conversación
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => release.mutate()}
          isLoading={release.isPending}
        >
          <Bot className="size-4" aria-hidden />
          Devolver al asistente
        </Button>
      )}
    </header>
  );
}

function MessageList({ messages, timeZone }: { messages: InboxMessage[]; timeZone: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  return (
    <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} timeZone={timeZone} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function Composer({
  conversationId,
  chatbotEnabled,
}: {
  conversationId: string;
  chatbotEnabled: boolean;
}) {
  const [draft, setDraft] = useState("");
  const send = useSendMessage(conversationId);

  function submit() {
    const content = draft.trim();
    if (!content || send.isPending) return;
    send.mutate(content, { onSuccess: () => setDraft("") });
  }

  if (chatbotEnabled) {
    return (
      <div className="border-t border-[var(--border-subtle)] p-3">
        <InlineAlert variant="warning" title="El asistente está atendiendo esta conversación">
          Pulsa <strong>Tomar conversación</strong> para responder tú.
        </InlineAlert>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 border-t border-[var(--border-subtle)] p-3">
      <Textarea
        rows={2}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Enter envía, Mayús+Enter hace salto de línea.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Escribe un mensaje…"
        aria-label="Mensaje"
        className="resize-none"
      />
      <Button onClick={submit} isLoading={send.isPending} disabled={!draft.trim()}>
        Enviar
      </Button>
    </div>
  );
}
