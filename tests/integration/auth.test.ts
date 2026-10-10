import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { rateLimit } from "@/server/security/rate-limit";
import { createUser, resetDb } from "../support/db";

const PASSWORD = "Violet-Harbour-Lantern-42";

describe("authentification (Better Auth, base réelle)", () => {
  beforeEach(resetDb);

  it("une inscription crée toujours un ÉTUDIANT en ATTENTE, avec un mot de passe Argon2id", async () => {
    const res = await auth.api.signUpEmail({
      body: { name: "Amina", email: "Amina@Example.test", password: PASSWORD },
    });
    const user = await db.user.findUniqueOrThrow({ where: { id: res.user.id }, include: { accounts: true, profile: true } });
    expect(user).toMatchObject({ email: "amina@example.test", role: "STUDENT", status: "PENDING", emailVerified: false });
    expect(user.accounts[0]!.password).toMatch(/^\$argon2id\$/);
    expect(user.profile).not.toBeNull();
  });

  it("refuse une inscription directe en HTTP (passage obligatoire par la Server Action)", async () => {
    const res = await auth.handler(
      new Request("http://localhost:3100/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3100" },
        body: JSON.stringify({ name: "X", email: "x@example.test", password: PASSWORD, role: "ADMIN" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(await db.user.count()).toBe(0);
  });

  it("refuse la connexion tant que l'email n'est pas vérifié", async () => {
    await auth.api.signUpEmail({ body: { name: "Amina", email: "amina@example.test", password: PASSWORD } });
    await expect(
      auth.api.signInEmail({ body: { email: "amina@example.test", password: PASSWORD } }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("verrouille le compte après 5 échecs, même avec le bon mot de passe ensuite", async () => {
    await auth.api.signUpEmail({ body: { name: "Amina", email: "amina@example.test", password: PASSWORD } });
    await db.user.update({ where: { email: "amina@example.test" }, data: { emailVerified: true } });

    for (let i = 0; i < 5; i++) {
      await expect(
        auth.api.signInEmail({ body: { email: "amina@example.test", password: "Wrong-Password-000" } }),
      ).rejects.toMatchObject({ statusCode: 401 });
    }
    const locked = await db.user.findUniqueOrThrow({ where: { email: "amina@example.test" } });
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    await expect(
      auth.api.signInEmail({ body: { email: "amina@example.test", password: PASSWORD } }),
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it("une connexion réussie réinitialise le compteur d'échecs", async () => {
    await auth.api.signUpEmail({ body: { name: "Amina", email: "amina@example.test", password: PASSWORD } });
    await db.user.update({ where: { email: "amina@example.test" }, data: { emailVerified: true } });
    await expect(
      auth.api.signInEmail({ body: { email: "amina@example.test", password: "Wrong-Password-000" } }),
    ).rejects.toBeTruthy();
    await auth.api.signInEmail({ body: { email: "amina@example.test", password: PASSWORD } });
    const user = await db.user.findUniqueOrThrow({ where: { email: "amina@example.test" } });
    expect(user.failedLoginCount).toBe(0);
    expect(user.lastLoginAt).not.toBeNull();
  });

  it("les jetons de vérification sont stockés hachés", async () => {
    await auth.api.signUpEmail({ body: { name: "Amina", email: "amina@example.test", password: PASSWORD } });
    await createUser(); // bruit
    const tokens = await db.verification.findMany();
    for (const t of tokens) expect(t.identifier).not.toContain("amina@example.test");
  });
});

describe("limitation de débit applicative (Postgres)", () => {
  beforeEach(resetDb);

  it("bloque au-delà de la limite puis indique le délai", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("signUp", "198.51.100.1"));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[3]!.retryAfterSec).toBeGreaterThan(0);
    expect((await rateLimit("signUp", "198.51.100.2")).ok).toBe(true); // autre IP
  });

  it("ne stocke pas l'identifiant en clair", async () => {
    await rateLimit("signIn", "198.51.100.9|amina@example.test");
    const rows = await db.rateLimit.findMany();
    expect(rows.some((r) => r.key.includes("amina") || r.key.includes("198.51"))).toBe(false);
  });
});
