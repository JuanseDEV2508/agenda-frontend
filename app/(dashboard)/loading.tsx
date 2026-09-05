import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando inicio">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
