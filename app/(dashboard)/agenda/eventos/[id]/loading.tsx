import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true" aria-label="Cargando evento">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
