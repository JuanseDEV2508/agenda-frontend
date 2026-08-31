"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { ConversationList } from "@/components/chat/conversation-list";
import { ConversationThread } from "@/components/chat/conversation-thread";
import { AdvisorFilter } from "@/components/chat/advisor-filter";
import { routes } from "@/config/routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { useConversations } from "@/features/inbox/hooks/use-chat";
import { canSelectAdvisor } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

/** La conversación abierta vive en la URL: regala enlace directo y botón atrás. */
const PARAM = "c";
const ADVISOR_PARAM = "a";

export function ChatView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, timezone } = useSession();
  const selectedId = searchParams.get(PARAM);
  const showAdvisor = canSelectAdvisor(user);
  // El filtro solo lo ve quien puede consultar varios asesores; un asesor ya
  // recibe únicamente las suyas desde el backend.
  const advisorFilter = showAdvisor ? (searchParams.get(ADVISOR_PARAM) ?? undefined) : undefined;

  const { conversations, isLoading, isError, error, refetch } = useConversations({
    advisor: advisorFilter,
  });

  function navigate(next: { conversationId?: string | null; advisor?: string }) {
    const params = new URLSearchParams(searchParams);
    const conversationId =
      next.conversationId === undefined ? searchParams.get(PARAM) : next.conversationId;

    if (conversationId) params.set(PARAM, conversationId);
    else params.delete(PARAM);
    if (next.advisor) params.set(ADVISOR_PARAM, next.advisor);
    else if (next.advisor === "") params.delete(ADVISOR_PARAM);

    const query = params.toString();
    router.push(query ? `${routes.chat}?${query}` : routes.chat, { scroll: false });
  }

  return (
    <div className="grid h-[calc(100dvh-8.5rem)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] lg:grid-cols-[320px_1fr]">
      {/* En móvil solo se ve un panel: la lista, o el hilo si hay uno abierto. */}
      <div
        className={cn(
          "min-h-0 overflow-y-auto lg:block lg:border-r lg:border-[var(--border-subtle)]",
          selectedId ? "hidden" : "block",
        )}
      >
        {showAdvisor ? (
          <AdvisorFilter
            value={advisorFilter ?? ""}
            onChange={(advisor) => navigate({ advisor, conversationId: null })}
          />
        ) : null}

        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={(conversationId) => navigate({ conversationId })}
          showAdvisor={showAdvisor}
          timeZone={timezone}
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={() => void refetch()}
        />
      </div>

      <div className={cn("min-h-0 lg:block", selectedId ? "block" : "hidden")}>
        <ConversationThread
          conversationId={selectedId}
          onBack={() => navigate({ conversationId: null })}
        />
      </div>
    </div>
  );
}
