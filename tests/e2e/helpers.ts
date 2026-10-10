import { createHmac } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MAILBOX = ".dev-mailbox-e2e";

type Mail = { to: string[]; subject: string; html: string };

/** Attend le dernier email reçu par `to` dont le contenu contient `contains`, et renvoie ses liens. */
export async function waitForEmailLink(to: string, contains: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = (await readdir(MAILBOX).catch(() => [] as string[])).sort().reverse();
    for (const f of files) {
      const mail = JSON.parse(await readFile(path.join(MAILBOX, f), "utf8")) as Mail;
      if (!mail.to.includes(to)) continue;
      const link = [...mail.html.matchAll(/href="([^"]+)"/g)]
        .map((m) => m[1]!.replaceAll("&amp;", "&"))
        .find((href) => href.includes(contains));
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Aucun email pour ${to} contenant ${contains}`);
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of input.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

/** Code TOTP (RFC 6238 : SHA-1, 30 s, 6 chiffres) — simule l'application d'authentification. */
export function totp(secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}
