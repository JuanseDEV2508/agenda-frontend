import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando seguimientos">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
