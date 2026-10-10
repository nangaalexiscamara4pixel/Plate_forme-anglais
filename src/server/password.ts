import { hash, verify } from "@node-rs/argon2";

// Paramètres Argon2id recommandés par l'OWASP (m = 19 Mio, t = 2, p = 1).
const OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword({ hash: digest, password }: { hash: string; password: string }) {
  try {
    return await verify(digest, password);
  } catch {
    // Hash corrompu ou dans un autre format : on refuse sans divulguer la cause.
    return false;
  }
}
