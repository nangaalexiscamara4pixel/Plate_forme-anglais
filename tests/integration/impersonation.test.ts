import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { resetDb } from "../support/db";
import { cookieHeader, requestHeaders, signedInUser } from "../support/auth";

const APP = "http://localhost:3100/api/auth";

describe("impersonation et routes admin de Better Auth", () => {
  beforeEach(resetDb);

  it("les routes HTTP du plugin admin sont fermées, même pour un administrateur connecté", async () => {
    const admin = await signedInUser({ email: "admin@example.test", role: "ADMIN" });
    const student = await signedInUser({ email: "eleve@example.test" });
    for (const [path, body] of [
      ["/admin/set-role", { userId: student.id, role: "ADMIN" }],
      ["/admin/impersonate-user", { userId: student.id }],
      ["/admin/set-user-password", { userId: student.id, newPassword: "Another-Password-123" }],
      ["/admin/remove-user", { userId: student.id }],
    ] as const) {
      const res = await auth.handler(
        new Request(APP + path, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: admin.cookie, origin: "http://localhost:3100" },
          body: JSON.stringify(body),
        }),
      );
      expect(res.status, path).toBe(403);
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: student.id } })).role).toBe("STUDENT");
  });

  it("un étudiant ne peut pas se promouvoir administrateur via l'API", async () => {
    const student = await signedInUser({ email: "eleve@example.test" });
    const res = await auth.handler(
      new Request(`${APP}/update-user`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: student.cookie, origin: "http://localhost:3100" },
        body: JSON.stringify({ role: "ADMIN", status: "APPROVED", name: "Hacker" }),
      }),
    );
    // `role` et `status` sont déclarés input:false : la requête est refusée ou ignorée.
    const after = await db.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(after.role).toBe("STUDENT");
    expect([200, 400]).toContain(res.status);
  });

  it("une session d'impersonation est en lecture seule et peut être quittée", async () => {
    const admin = await signedInUser({ email: "admin@example.test", role: "ADMIN" });
    const student = await signedInUser({ email: "eleve@example.test" });

    // Appel serveur (comme notre Server Action, après vérification de la 2FA)
    const { headers } = await auth.api.impersonateUser({
      body: { userId: student.id },
      headers: requestHeaders(admin.cookie),
      returnHeaders: true,
    });
    const impersonated = cookieHeader(headers, admin.cookie);

    const session = await auth.api.getSession({ headers: requestHeaders(impersonated) });
    expect(session?.user.id).toBe(student.id);
    expect((session?.session as { impersonatedBy?: string }).impersonatedBy).toBe(admin.id);
    expect(new Date(session!.session.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(30 * 60_000 + 5_000);

    // Toute modification de compte est refusée pendant l'impersonation
    for (const call of [
      () => auth.api.updateUser({ body: { name: "Modifié" }, headers: requestHeaders(impersonated) }),
      () =>
        auth.api.changePassword({
          body: { currentPassword: "x", newPassword: "Another-Password-123" },
          headers: requestHeaders(impersonated),
        }),
      () => auth.api.revokeSessions({ headers: requestHeaders(impersonated) }),
    ]) {
      await expect(call()).rejects.toMatchObject({ statusCode: 403 });
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: student.id } })).name).not.toBe("Modifié");

    // Sortie : la session admin d'origine est rétablie, la session d'impersonation supprimée
    const stop = await auth.api.stopImpersonating({ headers: requestHeaders(impersonated), returnHeaders: true });
    const restored = await auth.api.getSession({ headers: requestHeaders(cookieHeader(stop.headers, impersonated)) });
    expect(restored?.user.id).toBe(admin.id);
    expect(await db.session.count({ where: { impersonatedBy: admin.id } })).toBe(0);
  });

  it("refuse d'impersonner un administrateur", async () => {
    const admin = await signedInUser({ email: "admin@example.test", role: "ADMIN" });
    const other = await signedInUser({ email: "admin2@example.test", role: "ADMIN" });
    await expect(
      auth.api.impersonateUser({ body: { userId: other.id }, headers: requestHeaders(admin.cookie) }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("journalise la connexion d'un administrateur", async () => {
    const admin = await signedInUser({ email: "admin@example.test", role: "ADMIN" });
    // La connexion a eu lieu après le passage en ADMIN dans signedInUser
    expect(await db.auditLog.count({ where: { action: "admin.signin", actorId: admin.id } })).toBe(1);
  });
});
