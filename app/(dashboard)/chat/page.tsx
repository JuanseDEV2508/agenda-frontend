import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatView } from "@/components/chat/chat-view";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Chat",
};

export default function ChatPage() {
  return (
    // `useSearchParams` (la conversación abierta) requiere un límite de Suspense.
    <Suspense fallback={<ChatFallback />}>
      <ChatView />
    </Suspense>
  );
}

function ChatFallback() {
  return <Skeleton className="h-[calc(100dvh-8.5rem)] w-full" />;
}
