import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando chat">
      <Skeleton className="h-[calc(100dvh-8.5rem)] w-full" />
    </div>
  );
}
