import { redirect } from "next/navigation";

import { routes } from "@/config/routes";

/**
 * La raíz no tiene contenido propio: esta aplicación es una herramienta interna,
 * no un sitio público. El middleware redirige a `/login` si no hay sesión.
 */
export default function HomePage() {
  redirect(routes.agenda);
}
