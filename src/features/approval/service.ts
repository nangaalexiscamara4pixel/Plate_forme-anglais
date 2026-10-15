import type { AccountStatus } from "@/generated/prisma/client";
import { env } from "@/env";
import { audit, type AuditAction, type AuditContext } from "@/server/audit";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { statusChanged, type StatusEmailKind } from "@/server/email/templates";
import { localeOf } from "@/server/locale";

/**
 * Machine à états du statut d'un compte étudiant.
 * Toute modification de statut passe par `changeAccountStatus` — nulle part ailleurs.
 */
export const TRANSITIONS: Record<AccountStatus, readonly AccountStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["SUSPENDED"],
  SUSPENDED: ["APPROVED"],
  REJECTED: ["APPROVED"],
};

export function canTransition(from: AccountStatus, to: AccountStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class StatusChangeError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "NOT_A_STUDENT" | "INVALID_TRANSITION" | "LEVEL_REQUIRED" | "LEVEL_NOT_FOUND",
  ) {
    super(code);
  }
}

export type StatusChangeInput = {
  studentId: string;
  status: Exclude<AccountStatus, "PENDING">;
  levelId?: string;
  reason?: string;
};

/**
 * Change le statut d'un étudiant. L'appelant DOIT avoir vérifié que l'acteur est
 * administrateur (assertAdmin) ; ce service applique les règles métier :
 * transition autorisée, niveau obligatoire à l'approbation initiale, révocation
 * des sessions en cas de rejet/suspension, journal d'audit et email.
 * En approuvant, l'administrateur se porte garant de l'adresse : si l'étudiant n'a pas pu
 * cliquer sur le lien de confirmation (email non reçu), son adresse est confirmée (tracé dans l'audit).
 */
export async function changeAccountStatus(actor: AuditContext, input: StatusChangeInput) {
  const student = await db.user.findUnique({
    where: { id: input.studentId },
    select: { id: true, name: true, email: true, emailVerified: true, role: true, status: true, currentLevelId: true, deletedAt: true },
  });
  if (!student || student.deletedAt) throw new StatusChangeError("NOT_FOUND");
  if (student.role !== "STUDENT") throw new StatusChangeError("NOT_A_STUDENT");
  if (!canTransition(student.status, input.status)) throw new StatusChangeError("INVALID_TRANSITION");

  const approving = input.status === "APPROVED";
  const levelId = input.levelId ?? (approving ? student.currentLevelId : null) ?? undefined;
  if (approving && !levelId) throw new StatusChangeError("LEVEL_REQUIRED");
  const level = levelId ? await db.level.findUnique({ where: { id: levelId } }) : null;
  if (approving && !level) throw new StatusChangeError("LEVEL_NOT_FOUND");

  const action: AuditAction = approving
    ? student.status === "SUSPENDED"
      ? "student.reactivate"
      : "student.approve"
    : input.status === "REJECTED"
      ? "student.reject"
      : "student.suspend";

  const reason = input.reason?.trim() || null;
  const confirmEmail = approving && !student.emailVerified;

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: student.id },
      data: {
        status: input.status,
        statusReason: reason,
        statusChangedAt: new Date(),
        statusChangedById: actor.actorId,
        ...(approving && level ? { currentLevelId: level.id } : {}),
        ...(confirmEmail ? { emailVerified: true } : {}),
      },
    });

    if (approving && level) {
      await tx.levelEnrollment.upsert({
        where: { userId_levelId: { userId: student.id, levelId: level.id } },
        create: { userId: student.id, levelId: level.id, status: "ACTIVE", promotedById: actor.actorId },
        update: { status: "ACTIVE" },
      });
    } else {
      // Rejet ou suspension : déconnexion immédiate de tous les appareils.
      await tx.session.deleteMany({ where: { userId: student.id } });
    }

    await audit(
      actor,
      action,
      { type: "user", id: student.id },
      { from: student.status, to: input.status, levelCode: level?.code ?? null, reason, ...(confirmEmail ? { emailConfirmedByAdmin: true } : {}) },
      tx,
    );
  });

  const kind: StatusEmailKind = action === "student.reactivate" ? "REACTIVATED" : (input.status as StatusEmailKind);
  await sendEmail(
    student.email,
    statusChanged({
      name: student.name,
      kind,
      levelName: level ? `${level.code} – ${level.name}` : undefined,
      email: student.email,
      reason: input.status === "APPROVED" ? null : reason,
      // Approuvé ou réactivé : lien direct vers la connexion ; refusé : site public ; suspendu : page de statut.
      url: `${env.APP_URL}/${input.status === "APPROVED" ? "sign-in" : input.status === "REJECTED" ? "" : "account-status"}`,
      locale: await localeOf(student.id),
    }),
  );

  return { action, levelId: level?.id ?? null };
}
