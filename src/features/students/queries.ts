import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { PAGE_SIZE, type StudentFilters } from "./filters";

/**
 * Lectures réservées au back-office. Les appelants DOIVENT avoir vérifié le rôle
 * administrateur (requireAdmin / assertAdmin) : ces fonctions ne filtrent pas par
 * utilisateur, puisqu'un administrateur peut consulter tous les comptes étudiants.
 */

export function studentWhere(f: Pick<StudentFilters, "q" | "status" | "level">): Prisma.UserWhereInput {
  return {
    role: "STUDENT",
    deletedAt: null,
    ...(f.status ? { status: f.status } : {}),
    ...(f.level ? { currentLevel: { code: f.level } } : {}),
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" } },
            { email: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

const ORDER: Record<StudentFilters["sort"], Prisma.UserOrderByWithRelationInput[]> = {
  recent: [{ createdAt: "desc" }],
  oldest: [{ createdAt: "asc" }],
  name: [{ name: "asc" }],
  lastLogin: [{ lastLoginAt: { sort: "desc", nulls: "last" } }],
};

export const studentListSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  emailVerified: true,
  createdAt: true,
  lastLoginAt: true,
  twoFactorEnabled: true,
  currentLevel: { select: { code: true, name: true } },
  profile: { select: { country: true, whatsapp: true, timezone: true, uiLocale: true } },
} satisfies Prisma.UserSelect;

export async function listStudents(f: StudentFilters) {
  const where = studentWhere(f);
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [...ORDER[f.sort], { id: "asc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: studentListSelect,
    }),
    db.user.count({ where }),
  ]);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getStudentDetail(id: string) {
  const student = await db.user.findFirst({
    where: { id, role: "STUDENT", deletedAt: null },
    select: {
      ...studentListSelect,
      statusReason: true,
      statusChangedAt: true,
      statusChangedBy: { select: { name: true } },
      failedLoginCount: true,
      lockedUntil: true,
      currentLevelId: true,
      profile: {
        select: {
          country: true,
          whatsapp: true,
          timezone: true,
          uiLocale: true,
          nativeLanguage: true,
          goals: true,
          privacyConsentAt: true,
          privacyPolicyVersion: true,
        },
      },
      enrollments: {
        orderBy: { startedAt: "desc" },
        select: { id: true, status: true, startedAt: true, completedAt: true, level: { select: { code: true, name: true } } },
      },
      sessions: {
        where: { expiresAt: { gt: new Date() } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, createdAt: true, updatedAt: true, ipAddress: true, userAgent: true, impersonatedBy: true },
      },
      _count: {
        select: {
          lessonProgress: { where: { status: "COMPLETED" } },
          attempts: true,
          submissions: true,
          attendances: true,
          certificates: true,
        },
      },
    },
  });
  if (!student) return null;

  const [auditTrail, attendance, recentAttempts, recentSubmissions] = await Promise.all([
    db.auditLog.findMany({
      where: { targetType: "user", targetId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, action: true, createdAt: true, metadata: true, ip: true, actor: { select: { name: true } } },
    }),
    db.attendance.groupBy({ by: ["status"], where: { userId: id }, _count: true }),
    db.attempt.findMany({
      where: { userId: id, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 10,
      select: { id: true, score: true, maxScore: true, passed: true, submittedAt: true, exercise: { select: { title: true } } },
    }),
    db.submission.findMany({
      where: { userId: id, status: { not: "DRAFT" } },
      orderBy: { submittedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        assignment: { select: { title: true, skill: true } },
        feedback: { select: { score: true } },
      },
    }),
  ]);

  return { student, auditTrail, attendance, recentAttempts, recentSubmissions };
}

export type StudentDetail = NonNullable<Awaited<ReturnType<typeof getStudentDetail>>>;

/** Indicateurs du tableau de bord administrateur. */
export async function getAdminDashboard(now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [byStatus, byLevel, levels, registrations, recentActivity, pending] = await Promise.all([
    db.user.groupBy({ by: ["status"], where: { role: "STUDENT", deletedAt: null }, _count: true }),
    db.user.groupBy({
      by: ["currentLevelId"],
      where: { role: "STUDENT", deletedAt: null, status: "APPROVED" },
      _count: true,
    }),
    db.level.findMany({ orderBy: { order: "asc" }, select: { id: true, code: true, name: true } }),
    // Volume modeste (30 jours d'inscriptions) : agrégation par jour (UTC) en mémoire.
    db.user.findMany({
      where: { role: "STUDENT", deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, createdAt: true, targetId: true, actor: { select: { name: true } } },
    }),
    db.user.findMany({
      where: { role: "STUDENT", status: "PENDING", deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: { id: true, name: true, email: true, createdAt: true, profile: { select: { country: true, timezone: true } } },
    }),
  ]);

  const statusCount = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const perDay = new Map<string, number>();
  for (const r of registrations) {
    const key = r.createdAt.toISOString().slice(0, 10);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const days = Array.from({ length: 30 }, (_, i) => {
    const key = new Date(since.getTime() + (i + 1) * 86_400_000).toISOString().slice(0, 10);
    return { date: key, count: perDay.get(key) ?? 0 };
  });

  return {
    statuses: {
      PENDING: statusCount("PENDING"),
      APPROVED: statusCount("APPROVED"),
      REJECTED: statusCount("REJECTED"),
      SUSPENDED: statusCount("SUSPENDED"),
    },
    levels: levels.map((l) => ({ ...l, count: byLevel.find((b) => b.currentLevelId === l.id)?._count ?? 0 })),
    registrations: days,
    recentActivity,
    pending,
  };
}

export async function pendingCount() {
  return db.user.count({ where: { role: "STUDENT", status: "PENDING", deletedAt: null } });
}
