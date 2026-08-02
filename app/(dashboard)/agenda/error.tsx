"use client";

import { ErrorState } from "@/components/ui/feedback";

export default function AgendaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-10">
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}
