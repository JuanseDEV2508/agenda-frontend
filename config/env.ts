import "server-only";

/**
 * Variables de entorno del servidor.
 *
 * La URL del backend y el secreto de sesión NUNCA se exponen con el prefijo
 * `NEXT_PUBLIC_*`: el navegador habla siempre con los Route Handlers de Next
 * (`/api/proxy/...`) y es el servidor quien conoce y llama a la API real.
 */

function readApiBaseUrl(): string {
  const raw = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL;

  if (!raw) {
    throw new Error(
      "Falta la variable de entorno API_BASE_URL. Copia .env.example a .env.local y define la URL base del backend (por ejemplo http://localhost:8000/api/v1).",
    );
  }

  try {
    // Valida que sea una URL absoluta y normaliza la barra final.
    return new URL(raw).toString().replace(/\/+$/, "");
  } catch {
    throw new Error(
      `API_BASE_URL no es una URL válida: "${raw}". Debe ser absoluta, por ejemplo http://localhost:8000/api/v1.`,
    );
  }
}

function readAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "Falta la variable de entorno AUTH_SECRET (mínimo 32 caracteres). Genera una con: openssl rand -base64 32",
    );
  }

  return secret;
}

/** Lectura perezosa: falla con un mensaje claro en la primera petición, no al importar. */
export const serverEnv = {
  get apiBaseUrl() {
    return readApiBaseUrl();
  },
  get authSecret() {
    return readAuthSecret();
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

/** Comprueba la configuración sin lanzar; se usa para mostrar un aviso claro en desarrollo. */
export function checkServerEnv(): { ok: true } | { ok: false; message: string } {
  try {
    readApiBaseUrl();
    readAuthSecret();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
