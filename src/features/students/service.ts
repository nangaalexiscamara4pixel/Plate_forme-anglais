import { env } from "@/env";
import { audit, type AuditContext } from "@/server/audit";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { levelPromoted } from "@/server/email/templates";
import { localeOf } from "@/server/locale";
import type { StudentFilters } from "./filters";
import { studentListSelect, studentWhere } from "./queries";

/**
 * Opérations d'administration sur les comptes étudiants.
 * L'appelant DOIT avoir vérifié le rôle administrateur (assertAdmin) ; chaque
 * opération est journalisée dans l'audit.
 */

export class StudentOpError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "NOT_APPROVED" | "SAME_LEVEL" | "LEVEL_NOT_FOUND") {
    super(code);
  }
}

async function findStudent(id: string) {
  const student = await db.user.findFirst({
    where: { id, role: "STUDENT", deletedAt: null },
    select: { id: true, name: true, email: true, status: true, currentLevelId: true },
  });
  if (!student) throw new StudentOpError("NOT_FOUND");
  return student;
}

/**
 * Change le niveau d'un étudiant approuvé.
 *  - `promote` : passage au niveau supérieur, l'ancien niveau est marqué « validé » (reste accessible
 *    si le réglage l'autorise) et l'étudiant est félicité par email ;
 *  - `reassign` : correction d'affectation, l'ancien niveau est verrouillé.
 */
export async function changeStudentLevel(
  actor: AuditContext,
  input: { studentId: string; levelId: string; mode: "promote" | "reassign" },
) {
  const student = await findStudent(input.studentId);
  if (student.status !== "APPROVED") throw new StudentOpError("NOT_APPROVED");
  if (student.currentLevelId === input.levelId) throw new StudentOpError("SAME_LEVEL");
  const level = await db.level.findUnique({ where: { id: input.levelId } });
  if (!level) throw new StudentOpError("LEVEL_NOT_FOUND");
  const previous = student.currentLevelId
    ? await db.level.findUnique({ where: { id: student.currentLevelId }, select: { id: true, code: true } })
    : null;

  await db.$transaction(async (tx) => {
    if (previous) {
      await tx.levelEnrollment.updateMany({
        where: { userId: student.id, levelId: previous.id },
        data:
          input.mode === "promote"
            ? { status: "COMPLETED", completedAt: new Date() }
            : { status: "LOCKED" },
      });
    }
    await tx.levelEnrollment.upsert({
      where: { userId_levelId: { userId: student.id, levelId: level.id } },
      create: { userId: student.id, levelId: level.id, status: "ACTIVE", promotedById: actor.actorId },
      update: { status: "ACTIVE", completedAt: null, promotedById: actor.actorId },
    });
    await tx.user.update({ where: { id: student.id }, data: { currentLevelId: level.id } });
    await audit(
      actor,
      "student.level.change",
      { type: "user", id: student.id },
      { mode: input.mode, from: previous?.code ?? null, to: level.code },
      tx,
    );
  });

  if (input.mode === "promote") {
    await db.notification.create({
      data: { userId: student.id, type: "level.promoted", payload: { levelCode: level.code } },
    });
    await sendEmail(
      student.email,
      levelPromoted({
        name: student.name,
        levelName: `${level.code} – ${level.name}`,
        url: `${env.APP_URL}/app`,
        locale: await localeOf(student.id),
      }),
    );
  }
  return { from: previous?.code ?? null, to: level.code };
}

/** Déconnecte l'étudiant de tous ses appareils. */
export async function revokeAllSessions(actor: AuditContext, studentId: string) {
  const student = await findStudent(studentId);
  const { count } = await db.session.deleteMany({ where: { userId: student.id } });
  await audit(actor, "student.sessions.revoke", { type: "user", id: student.id }, { count });
  return count;
}

/** Révoque une session précise — uniquement si elle appartient bien à cet étudiant. */
export async function revokeOneSession(actor: AuditContext, studentId: string, sessionId: string) {
  const student = await findStudent(studentId);
  const { count } = await db.session.deleteMany({ where: { id: sessionId, userId: student.id } });
  if (count === 0) throw new StudentOpError("NOT_FOUND");
  await audit(actor, "student.session.revoke", { type: "user", id: student.id }, { sessionId });
}

/**
 * Envoie à l'étudiant un lien de réinitialisation. L'administrateur ne voit ni ne choisit
 * jamais le mot de passe ; le lien expire après 30 minutes.
 */
export async function sendStudentPasswordReset(actor: AuditContext, studentId: string) {
  const student = await findStudent(studentId);
  await auth.api.requestPasswordReset({ body: { email: student.email, redirectTo: `${env.APP_URL}/reset-password` } });
  await audit(actor, "student.password.reset", { type: "user", id: student.id });
}

/**
 * Trace la consultation d'un compte par un administrateur (accès à des données personnelles).
 * Dédoublonnée sur 10 minutes pour ne pas noyer le journal lors d'une navigation entre onglets.
 */
export async function recordStudentView(actor: AuditContext, studentId: string) {
  const recent = await db.auditLog.findFirst({
    where: {
      actorId: actor.actorId,
      action: "student.view",
      targetId: studentId,
      createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
    },
    select: { id: true },
  });
  if (!recent) await audit(actor, "student.view", { type: "user", id: studentId });
}

// ── Export CSV ────────────────────────────────────────────────────────────────

/**
 * Neutralise l'injection de formules (CSV injection) : une cellule commençant par
 * = + - @ ou une tabulation serait interprétée comme formule par Excel/Sheets.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const CSV_COLUMNS = [
  "id",
  "name",
  "email",
  "status",
  "level",
  "country",
  "whatsapp",
  "timezone",
  "language",
  "emailVerified",
  "twoFactor",
  "registeredAt",
  "lastLoginAt",
] as const;

export const CSV_MAX_ROWS = 10_000;

export async function exportStudentsCsv(actor: AuditContext, filters: Pick<StudentFilters, "q" | "status" | "level">) {
  const rows = await db.user.findMany({
    where: studentWhere(filters),
    orderBy: { createdAt: "asc" },
    take: CSV_MAX_ROWS,
    select: studentListSelect,
  });
  const lines = [
    CSV_COLUMNS.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.name,
        r.email,
        r.status,
        r.currentLevel?.code,
        r.profile?.country,
        r.profile?.whatsapp,
        r.profile?.timezone,
        r.profile?.uiLocale,
        r.emailVerified,
        Boolean(r.twoFactorEnabled),
        r.createdAt,
        r.lastLoginAt,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  await audit(actor, "student.export.csv", undefined, { count: rows.length, filters });
  // BOM UTF-8 : Excel affiche correctement les accents.
  return `﻿${lines.join("\r\n")}\r\n`;
}
