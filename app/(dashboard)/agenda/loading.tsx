import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando agenda">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
