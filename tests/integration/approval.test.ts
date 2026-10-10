import { beforeEach, describe, expect, it } from "vitest";
import { changeAccountStatus, StatusChangeError } from "@/features/approval/service";
import { db } from "@/server/db";
import { createSession, createUser, resetDb, seedLevels } from "../support/db";

describe("workflow d'approbation (base réelle)", () => {
  let adminId: string;
  let levels: Awaited<ReturnType<typeof seedLevels>>;

  beforeEach(async () => {
    await resetDb();
    levels = await seedLevels();
    adminId = (await createUser({ role: "ADMIN", status: "APPROVED" })).id;
  });

  const actor = () => ({ actorId: adminId, ip: "203.0.113.7", userAgent: "vitest" });

  it("approuve un compte en attente avec un niveau, crée l'inscription et l'audit", async () => {
    const student = await createUser();
    const b1 = levels.find((l) => l.code === "B1")!;

    await changeAccountStatus(actor(), { studentId: student.id, status: "APPROVED", levelId: b1.id });

    const updated = await db.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(updated.status).toBe("APPROVED");
    expect(updated.currentLevelId).toBe(b1.id);
    expect(updated.statusChangedById).toBe(adminId);

    const enrollment = await db.levelEnrollment.findUniqueOrThrow({
      where: { userId_levelId: { userId: student.id, levelId: b1.id } },
    });
    expect(enrollment.status).toBe("ACTIVE");

    const log = await db.auditLog.findFirstOrThrow({ where: { targetId: student.id } });
    expect(log).toMatchObject({ action: "student.approve", actorId: adminId, ip: "203.0.113.7" });
    expect(log.metadata).toMatchObject({ from: "PENDING", to: "APPROVED", levelCode: "B1" });
  });

  it("refuse l'approbation sans niveau", async () => {
    const student = await createUser();
    await expect(changeAccountStatus(actor(), { studentId: student.id, status: "APPROVED" })).rejects.toMatchObject({
      code: "LEVEL_REQUIRED",
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: student.id } })).status).toBe("PENDING");
  });

  it("rejette une demande et révoque toutes les sessions", async () => {
    const student = await createUser();
    await createSession(student.id);
    await createSession(student.id);

    await changeAccountStatus(actor(), { studentId: student.id, status: "REJECTED", reason: "Profil incomplet" });

    expect(await db.session.count({ where: { userId: student.id } })).toBe(0);
    const updated = await db.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(updated).toMatchObject({ status: "REJECTED", statusReason: "Profil incomplet" });
  });

  it("suspend puis réactive en conservant le niveau", async () => {
    const a2 = levels.find((l) => l.code === "A2")!;
    const student = await createUser({ status: "APPROVED", currentLevelId: a2.id });
    await createSession(student.id);

    await changeAccountStatus(actor(), { studentId: student.id, status: "SUSPENDED" });
    expect(await db.session.count({ where: { userId: student.id } })).toBe(0);

    const { action } = await changeAccountStatus(actor(), { studentId: student.id, status: "APPROVED" });
    expect(action).toBe("student.reactivate");
    const updated = await db.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(updated).toMatchObject({ status: "APPROVED", currentLevelId: a2.id });
  });

  it("interdit une transition non prévue", async () => {
    const student = await createUser();
    await expect(changeAccountStatus(actor(), { studentId: student.id, status: "SUSPENDED" })).rejects.toBeInstanceOf(
      StatusChangeError,
    );
  });

  it("ne permet pas de modifier le statut d'un administrateur", async () => {
    const otherAdmin = await createUser({ role: "ADMIN", status: "APPROVED" });
    await expect(
      changeAccountStatus(actor(), { studentId: otherAdmin.id, status: "SUSPENDED" }),
    ).rejects.toMatchObject({ code: "NOT_A_STUDENT" });
  });

  it("envoie un email à l'étudiant à chaque changement", async () => {
    const { readdir } = await import("node:fs/promises");
    const { DEV_MAILBOX_DIR } = await import("@/server/email/send");
    const before = (await readdir(DEV_MAILBOX_DIR).catch(() => [])).length;
    const student = await createUser();
    await changeAccountStatus(actor(), { studentId: student.id, status: "APPROVED", levelId: levels[0]!.id });
    const after = (await readdir(DEV_MAILBOX_DIR)).length;
    expect(after).toBe(before + 1);
  });
});
