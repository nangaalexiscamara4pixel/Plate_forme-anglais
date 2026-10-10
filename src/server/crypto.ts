import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/env";

/**
 * Chiffrement symétrique AES-256-GCM pour les données sensibles stockées en base
 * (liens Google Meet…). Format : base64url(iv).base64url(tag).base64url(ciphertext)
 */
const key = Buffer.from(env.ENCRYPTION_KEY, "base64");

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, ciphertext] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !ciphertext) throw new Error("Payload chiffré invalide");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Empreinte non réversible (ex. clé de rate limit à partir d'un email). */
export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 32);
}
