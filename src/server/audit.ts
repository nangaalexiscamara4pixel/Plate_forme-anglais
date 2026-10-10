import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export type AuditAction =
  | "student.approve"
  | "student.reject"
  | "student.suspend"
  | "student.reactivate"
  | "student.level.change"
  | "student.sessions.revoke"
  | "student.password.reset"
  | "student.export.csv"
  | "admin.signin"
  | "impersonation.start"
  | "impersonation.stop";

export type AuditContext = {
  actorId: string;
  impersonatorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Écrit une entrée dans le journal d'audit (append-only).
 * `metadata` ne doit JAMAIS contenir de secret (mot de passe, jeton, lien Meet).
 */
export async function audit(
  ctx: AuditContext,
  action: AuditAction,
  target?: { type: string; id: string },
  metadata?: Prisma.InputJsonValue,
  tx: Prisma.TransactionClient = db,
) {
  await tx.auditLog.create({
    data: {
      actorId: ctx.actorId,
      impersonatorId: ctx.impersonatorId ?? null,
      action,
      targetType: target?.type,
      targetId: target?.id,
      metadata,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent?.slice(0, 512) ?? null,
    },
  });
}
