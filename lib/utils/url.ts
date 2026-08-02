/**
 * Devuelve la URL sólo si es segura para renderizar como enlace.
 * Evita esquemas peligrosos como `javascript:` provenientes de datos externos.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Texto compacto para mostrar un enlace largo. */
export function displayUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}
