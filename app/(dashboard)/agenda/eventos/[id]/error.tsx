"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { routes } from "@/config/routes";

export default function EventError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-10">
      <ErrorState error={error} onRetry={reset} />
      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link href={routes.agenda}>Volver a la agenda</Link>
        </Button>
      </div>
    </div>
  );
}
