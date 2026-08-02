import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { serverEnv } from "@/config/env";

/**
 * Cifrado autenticado (AES-256-GCM) del contenido de la cookie de sesión.
 *
 * Sólo se ejecuta en el servidor. El navegador recibe una cookie `httpOnly`
 * opaca: no puede leerla desde JavaScript ni interpretarla.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(): Buffer {
  return createHash("sha256").update(serverEnv.authSecret).digest();
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

export function decryptJson<T>(token: string): T | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length <= IV_LENGTH + AUTH_TAG_LENGTH) return null;

    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    // Cookie manipulada, con secreto distinto o corrupta: se trata como "sin sesión".
    return null;
  }
}
