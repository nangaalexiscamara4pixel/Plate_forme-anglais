import { readdir } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import { listAuditLogs, parseAuditFilters } from "@/features/audit/queries";
import { parseStudentFilters } from "@/features/students/filters";
import { getAdminDashboard, listStudents } from "@/features/students/queries";
import {
  changeStudentLevel,
  csvCell,
  exportStudentsCsv,
  recordStudentView,
  revokeAllSessions,
  revokeOneSession,
  sendStudentPasswordReset,
} from "@/features/students/service";
import { db } from "@/server/db";
import { DEV_MAILBOX_DIR } from "@/server/email/send";
import { createSession, createUser, resetDb, seedLevels } from "../support/db";

describe("back-office : opérations sur les étudiants", () => {
  let levels: Awaited<ReturnType<typeof seedLevels>>;
  let adminId: string;
  const actor = () => ({ actorId: adminId, ip: "203.0.113.9", userAgent: "vitest" });
  const level = (code: string) => levels.find((l) => l.code === code)!;

  beforeEach(async () => {
    await resetDb();
    levels = await seedLevels();
    adminId = (await createUser({ role: "ADMIN", status: "APPROVED" })).id;
  });

  describe("changement de niveau", () => {
    it("promotion : l'ancien niveau est validé, le nouveau actif, l'étudiant notifié", async () => {
      const s = await createUser({ status: "APPROVED", currentLevelId: level("A1").id });
      await db.levelEnrollment.create({ data: { userId: s.id, levelId: level("A1").id } });

      const res = await changeStudentLevel(actor(), { studentId: s.id, levelId: level("A2").id, mode: "promote" });
      expect(res).toEqual({ from: "A1", to: "A2" });

      const enrollments = await db.levelEnrollment.findMany({ where: { userId: s.id }, include: { level: true } });
      expect(enrollments.find((e) => e.level.code === "A1")).toMatchObject({ status: "COMPLETED" });
      expect(enrollments.find((e) => e.level.code === "A1")!.completedAt).not.toBeNull();
      expect(enrollments.find((e) => e.level.code === "A2")).toMatchObject({ status: "ACTIVE" });
      expect((await db.user.findUniqueOrThrow({ where: { id: s.id } })).currentLevelId).toBe(level("A2").id);
      expect(await db.notification.count({ where: { userId: s.id, type: "level.promoted" } })).toBe(1);
      expect(await db.auditLog.findFirst({ where: { action: "student.level.change", targetId: s.id } })).toMatchObject({
        metadata: { mode: "promote", from: "A1", to: "A2" },
      });
    });

    it("réaffectation : l'ancien niveau est verrouillé", async () => {
      const s = await createUser({ status: "APPROVED", currentLevelId: level("B2").id });
      await db.levelEnrollment.create({ data: { userId: s.id, levelId: level("B2").id } });
      await changeStudentLevel(actor(), { studentId: s.id, levelId: level("B1").id, mode: "reassign" });
      const old = await db.levelEnrollment.findFirstOrThrow({ where: { userId: s.id, levelId: level("B2").id } });
      expect(old.status).toBe("LOCKED");
    });

    it("refuse un compte non approuvé ou un niveau identique", async () => {
      const pending = await createUser();
      await expect(
        changeStudentLevel(actor(), { studentId: pending.id, levelId: level("A1").id, mode: "promote" }),
      ).rejects.toMatchObject({ code: "NOT_APPROVED" });
      const s = await createUser({ status: "APPROVED", currentLevelId: level("A1").id });
      await expect(
        changeStudentLevel(actor(), { studentId: s.id, levelId: level("A1").id, mode: "promote" }),
      ).rejects.toMatchObject({ code: "SAME_LEVEL" });
    });

    it("ne s'applique pas à un administrateur", async () => {
      const other = await createUser({ role: "ADMIN", status: "APPROVED" });
      await expect(
        changeStudentLevel(actor(), { studentId: other.id, levelId: level("A1").id, mode: "promote" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("sessions", () => {
    it("révoque toutes les sessions d'un étudiant, et seulement les siennes", async () => {
      const a = await createUser({ status: "APPROVED" });
      const b = await createUser({ status: "APPROVED" });
      await createSession(a.id);
      await createSession(a.id);
      await createSession(b.id);
      expect(await revokeAllSessions(actor(), a.id)).toBe(2);
      expect(await db.session.count({ where: { userId: b.id } })).toBe(1);
    });

    it("IDOR : impossible de révoquer la session d'un autre étudiant en passant un mauvais couple", async () => {
      const a = await createUser({ status: "APPROVED" });
      const b = await createUser({ status: "APPROVED" });
      const sessionOfB = await createSession(b.id);
      await expect(revokeOneSession(actor(), a.id, sessionOfB.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await db.session.count({ where: { id: sessionOfB.id } })).toBe(1);
    });
  });

  it("envoie un lien de réinitialisation sans jamais exposer de mot de passe", async () => {
    const s = await createUser({ status: "APPROVED", email: "reset@example.test" });
    await db.account.create({
      data: { id: crypto.randomUUID(), accountId: s.id, providerId: "credential", userId: s.id, password: "x" },
    });
    const before = (await readdir(DEV_MAILBOX_DIR).catch(() => [])).length;
    await sendStudentPasswordReset(actor(), s.id);
    expect((await readdir(DEV_MAILBOX_DIR)).length).toBe(before + 1);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "student.password.reset" } });
    expect(JSON.stringify(log)).not.toMatch(/token|password=/i);
  });

  it("dédoublonne la trace de consultation d'un compte sur 10 minutes", async () => {
    const s = await createUser();
    await recordStudentView(actor(), s.id);
    await recordStudentView(actor(), s.id);
    expect(await db.auditLog.count({ where: { action: "student.view", targetId: s.id } })).toBe(1);
  });

  describe("liste et filtres", () => {
    beforeEach(async () => {
      await createUser({ name: "Amina Diallo", email: "amina@example.test", status: "APPROVED", currentLevelId: level("B1").id });
      await createUser({ name: "Bruno Costa", email: "bruno@example.test", status: "PENDING" });
      await createUser({ name: "Chen Wei", email: "chen@example.test", status: "SUSPENDED", currentLevelId: level("A2").id });
    });

    it("ne liste jamais les administrateurs", async () => {
      const { rows } = await listStudents(parseStudentFilters({}));
      expect(rows.map((r) => r.email).sort()).toEqual(["amina@example.test", "bruno@example.test", "chen@example.test"]);
    });

    it("filtre par statut, niveau et recherche insensible à la casse", async () => {
      expect((await listStudents(parseStudentFilters({ status: "PENDING" }))).rows.map((r) => r.name)).toEqual(["Bruno Costa"]);
      expect((await listStudents(parseStudentFilters({ level: "B1" }))).rows.map((r) => r.name)).toEqual(["Amina Diallo"]);
      expect((await listStudents(parseStudentFilters({ q: "CHEN" }))).rows.map((r) => r.name)).toEqual(["Chen Wei"]);
    });

    it("ignore les valeurs de filtre invalides au lieu d'échouer", async () => {
      const f = parseStudentFilters({ status: "HACKED", level: "Z9", page: "-4", sort: "drop table" });
      expect(f).toMatchObject({ status: undefined, level: undefined, page: 1, sort: "recent" });
    });

    it("calcule les indicateurs du tableau de bord", async () => {
      const d = await getAdminDashboard();
      expect(d.statuses).toEqual({ PENDING: 1, APPROVED: 1, REJECTED: 0, SUSPENDED: 1 });
      expect(d.levels.find((l) => l.code === "B1")!.count).toBe(1);
      expect(d.levels.find((l) => l.code === "A2")!.count).toBe(0); // suspendu : non compté comme actif
      expect(d.registrations).toHaveLength(30);
      expect(d.registrations.reduce((a, r) => a + r.count, 0)).toBe(3);
    });
  });

  describe("export CSV", () => {
    it("neutralise l'injection de formules et échappe les guillemets", () => {
      expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
      expect(csvCell("+33 6 12")).toBe("'+33 6 12");
      expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
      expect(csvCell("Dupont, Jean")).toBe('"Dupont, Jean"');
      expect(csvCell(null)).toBe("");
    });

    it("exporte selon les filtres, avec BOM, et journalise l'export", async () => {
      await createUser({ name: "=cmd|' /C calc'!A0", email: "x@example.test", status: "APPROVED" });
      await createUser({ name: "Pending", email: "p@example.test", status: "PENDING" });
      const csv = await exportStudentsCsv(actor(), { q: undefined, level: undefined, status: "APPROVED" });
      expect(csv.startsWith("﻿id,name,email")).toBe(true);
      const lines = csv.trim().split("\r\n");
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain("'=cmd");
      expect(csv).not.toContain("p@example.test");
      const log = await db.auditLog.findFirstOrThrow({ where: { action: "student.export.csv" } });
      expect(log.metadata).toMatchObject({ count: 1, filters: { status: "APPROVED" } });
    });
  });

  describe("journal d'audit", () => {
    it("filtre par action, auteur et période", async () => {
      const s = await createUser({ status: "APPROVED" });
      await revokeAllSessions(actor(), s.id);
      await recordStudentView(actor(), s.id);
      const all = await listAuditLogs(parseAuditFilters({}));
      expect(all.total).toBe(2);
      const onlyView = await listAuditLogs(parseAuditFilters({ action: "student.view" }));
      expect(onlyView.rows.map((r) => r.action)).toEqual(["student.view"]);
      expect(onlyView.rows[0]!.target?.id).toBe(s.id);
      const future = await listAuditLogs(parseAuditFilters({ from: "2999-01-01" }));
      expect(future.total).toBe(0);
      const unknownAction = parseAuditFilters({ action: "drop" });
      expect(unknownAction.action).toBeUndefined();
    });
  });
});
