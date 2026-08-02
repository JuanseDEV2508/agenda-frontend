import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { NEXT_PARAM, PATHNAME_HEADER, routes } from "@/config/routes";
import { SessionProvider } from "@/features/auth/hooks/use-session";
import { getSession } from "@/lib/auth/session";

/**
 * Layout autenticado.
 *
 * La sesión se resuelve en el servidor ANTES de renderizar: no existe un
 * instante en el que se muestre contenido privado sin usuario válido (§6.4).
 * El middleware ya bloquea el acceso sin cookie; aquí se cubre además el caso
 * de una cookie presente pero expirada o inválida.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    const requestHeaders = await headers();
    const requestedPath = requestHeaders.get(PATHNAME_HEADER);
    const target = requestedPath
      ? `${routes.login}?${NEXT_PARAM}=${encodeURIComponent(requestedPath)}`
      : routes.login;

    redirect(target);
  }

  return (
    <SessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
