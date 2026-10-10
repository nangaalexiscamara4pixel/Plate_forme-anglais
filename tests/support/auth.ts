import { auth } from "@/server/auth";
import { db } from "@/server/db";

export const TEST_PASSWORD = "Violet-Harbour-Lantern-42";

/** Convertit les Set-Cookie d'une réponse en en-tête Cookie réutilisable. */
export function cookieHeader(headers: Headers, previous = ""): string {
  const jar = new Map(
    previous
      .split("; ")
      .filter(Boolean)
      .map((c) => c.split("=") as [string, string]),
  );
  for (const sc of headers.getSetCookie()) {
    const [pair] = sc.split(";");
    const idx = pair!.indexOf("=");
    const name = pair!.slice(0, idx);
    const value = pair!.slice(idx + 1);
    if (value === "" || /max-age=0/i.test(sc)) jar.delete(name);
    else jar.set(name, value);
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** Crée un compte via Better Auth (mot de passe réel), le vérifie et renvoie ses cookies de session. */
export async function signedInUser(opts: { email: string; role?: "ADMIN" | "STUDENT"; status?: "APPROVED" | "PENDING" }) {
  const res = await auth.api.signUpEmail({ body: { name: opts.email.split("@")[0]!, email: opts.email, password: TEST_PASSWORD } });
  await db.user.update({
    where: { id: res.user.id },
    data: { emailVerified: true, role: opts.role ?? "STUDENT", status: opts.status ?? "APPROVED" },
  });
  const { headers } = await auth.api.signInEmail({
    body: { email: opts.email, password: TEST_PASSWORD },
    returnHeaders: true,
  });
  return { id: res.user.id, cookie: cookieHeader(headers) };
}

export function requestHeaders(cookie: string) {
  return new Headers({ cookie, origin: "http://localhost:3100" });
}
