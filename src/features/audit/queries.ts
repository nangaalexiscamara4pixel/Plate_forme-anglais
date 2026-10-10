import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AUDIT_ACTIONS } from "@/server/audit";
import { db } from "@/server/db";

/** Lecture du journal d'audit — réservée aux administrateurs (requireAdmin chez l'appelant). */
export const AUDIT_PAGE_SIZE = 30;

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const auditFiltersSchema = z.object({
  action: z.enum(AUDIT_ACTIONS).optional().catch(undefined),
  actor: z.string().max(64).optional().catch(undefined),
  target: z.string().max(64).optional().catch(undefined),
  from: dateParam,
  to: dateParam,
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export type AuditFilters = z.infer<typeof auditFiltersSchema>;

export function parseAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  return auditFiltersSchema.parse(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
}

export async function listAuditLogs(f: AuditFilters) {
  const where: Prisma.AuditLogWhereInput = {
    ...(f.action ? { action: f.action } : {}),
    ...(f.actor ? { actorId: f.actor } : {}),
    ...(f.target ? { targetId: f.target } : {}),
    ...(f.from || f.to
      ? {
          createdAt: {
            ...(f.from ? { gte: new Date(`${f.from}T00:00:00Z`) } : {}),
            ...(f.to ? { lt: new Date(new Date(`${f.to}T00:00:00Z`).getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
  };
  const [rows, total, admins] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        impersonatorId: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    db.auditLog.count({ where }),
    db.user.findMany({ where: { role: "ADMIN" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Noms des comptes ciblés (une requête groupée, pas de N+1).
  const targetIds = [...new Set(rows.filter((r) => r.targetType === "user" && r.targetId).map((r) => r.targetId!))];
  const targets = targetIds.length
    ? await db.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, name: true, email: true } })
    : [];

  return {
    rows: rows.map((r) => ({ ...r, target: targets.find((t) => t.id === r.targetId) ?? null })),
    total,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
    admins,
  };
}
