import "server-only";
import { learnerScope } from "@/features/content/access";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/**
 * Devoirs (expression écrite et orale). Un étudiant ne voit que les devoirs PUBLIÉS de ses
 * niveaux et ne manipule que SES copies. Versions : après correction (« rendu »), il peut
 * déposer une nouvelle version ; l'historique est conservé.
 */
export class AssignmentError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "LOCKED" | "EMPTY" | "TOO_SHORT" | "TOO_LONG" | "AUDIO_INVALID" | "ATTACHMENT_INVALID" | "HAS_SUBMISSIONS") {
    super(code);
  }
}

export const countWords = (text: string) => (text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

export async function studentAssignmentWhere(userId: string): Promise<Prisma.AssignmentWhereInput> {
  const scope = await learnerScope(userId);
  return { status: "PUBLISHED", levelId: { in: scope.levelIds } };
}

const submissionSelect = {
  id: true,
  status: true,
  version: true,
  text: true,
  audioFileId: true,
  file: { select: { id: true, mime: true, originalName: true } },
  wordCount: true,
  durationSec: true,
  submittedAt: true,
  updatedAt: true,
  feedback: { select: { score: true, comment: true, returnedAt: true } },
} as const;

export async function listStudentAssignments(userId: string) {
  const where = await studentAssignmentWhere(userId);
  const rows = await db.assignment.findMany({
    where,
    orderBy: [{ level: { order: "asc" } }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      skill: true,
      minWords: true,
      maxWords: true,
      maxDurationSec: true,
      level: { select: { code: true } },
      submissions: { where: { userId }, orderBy: { version: "desc" }, take: 1, select: submissionSelect },
    },
  });
  return rows.map(({ submissions, ...a }) => ({ ...a, latest: submissions[0] ?? null }));
}

export async function getStudentAssignment(userId: string, assignmentId: string) {
  const where = await studentAssignmentWhere(userId);
  return db.assignment.findFirst({
    where: { ...where, id: assignmentId },
    select: {
      id: true,
      title: true,
      prompt: true,
      skill: true,
      minWords: true,
      maxWords: true,
      maxDurationSec: true,
      level: { select: { code: true } },
      materials: { orderBy: { order: "asc" }, select: { mediaFile: { select: { id: true, mime: true, originalName: true } } } },
      submissions: { where: { userId }, orderBy: { version: "desc" }, select: submissionSelect },
    },
  });
}

async function accessibleAssignment(userId: string, assignmentId: string) {
  const where = await studentAssignmentWhere(userId);
  const assignment = await db.assignment.findFirst({
    where: { ...where, id: assignmentId },
    select: { id: true, skill: true, minWords: true, maxWords: true, maxDurationSec: true },
  });
  if (!assignment) throw new AssignmentError("NOT_FOUND");
  return assignment;
}

/** Brouillon de la version en cours (créé au besoin ; nouvelle version après un retour de correction). */
export async function saveDraft(
  userId: string,
  assignmentId: string,
  input: { text?: string; audioFileId?: string | null; durationSec?: number; fileId?: string | null },
) {
  const assignment = await accessibleAssignment(userId, assignmentId);
  if (input.audioFileId) {
    const audio = await db.mediaFile.findFirst({
      where: { id: input.audioFileId, ownerUserId: userId, purpose: "SUBMISSION_AUDIO", uploadedAt: { not: null } },
      select: { id: true },
    });
    if (!audio) throw new AssignmentError("AUDIO_INVALID");
  }
  if (input.fileId) {
    const file = await db.mediaFile.findFirst({
      where: { id: input.fileId, ownerUserId: userId, purpose: "SUBMISSION_FILE", uploadedAt: { not: null } },
      select: { id: true },
    });
    if (!file) throw new AssignmentError("ATTACHMENT_INVALID");
  }
  const latest = await db.submission.findFirst({
    where: { userId, assignmentId },
    orderBy: { version: "desc" },
    select: { id: true, status: true, version: true, text: true, fileId: true },
  });
  if (latest && (latest.status === "SUBMITTED" || latest.status === "IN_REVIEW")) throw new AssignmentError("LOCKED");
  const data = {
    ...(input.text !== undefined && assignment.skill === "WRITING" ? { text: input.text, wordCount: countWords(input.text) } : {}),
    ...(input.audioFileId !== undefined && assignment.skill === "SPEAKING" ? { audioFileId: input.audioFileId, durationSec: input.durationSec ?? null } : {}),
    ...(input.fileId !== undefined ? { fileId: input.fileId } : {}),
  };
  if (latest?.status === "DRAFT") {
    return db.submission.update({ where: { id: latest.id }, data, select: { id: true, version: true } });
  }
  return db.submission.create({
    // Nouvelle version : reprend le texte précédent pour l'améliorer.
    data: {
      userId,
      assignmentId,
      version: (latest?.version ?? 0) + 1,
      text: latest?.text ?? null,
      wordCount: latest?.text ? countWords(latest.text) : null,
      fileId: latest?.fileId ?? null,
      ...data,
    },
    select: { id: true, version: true },
  });
}

export async function submitDraft(userId: string, assignmentId: string) {
  const assignment = await accessibleAssignment(userId, assignmentId);
  const draft = await db.submission.findFirst({ where: { userId, assignmentId, status: "DRAFT" }, orderBy: { version: "desc" } });
  if (!draft) throw new AssignmentError("EMPTY");
  if (assignment.skill === "WRITING") {
    const words = countWords(draft.text ?? "");
    // Un fichier joint (Word, PDF, photo de la copie) peut remplacer le texte saisi.
    if (words === 0 && !draft.fileId) throw new AssignmentError("EMPTY");
    if (!draft.fileId && assignment.minWords && words < assignment.minWords) throw new AssignmentError("TOO_SHORT");
    if (assignment.maxWords && words > assignment.maxWords) throw new AssignmentError("TOO_LONG");
  } else {
    if (!draft.audioFileId) throw new AssignmentError("EMPTY");
    if (assignment.maxDurationSec && (draft.durationSec ?? 0) > assignment.maxDurationSec + 5) throw new AssignmentError("TOO_LONG");
  }
  await db.submission.update({ where: { id: draft.id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
}

// ── Back-office ──────────────────────────────────────────────────────────────

const toReview = { status: { in: ["SUBMITTED", "IN_REVIEW"] } } satisfies Prisma.SubmissionWhereInput;

export const pendingReviewCount = () => db.submission.count({ where: toReview });

export async function listAdminAssignments() {
  const rows = await db.assignment.findMany({
    where: { status: { not: "ARCHIVED" }, lessonId: null },
    orderBy: [{ level: { order: "asc" } }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      skill: true,
      status: true,
      level: { select: { code: true } },
      _count: { select: { submissions: { where: { status: { not: "DRAFT" } } } } },
    },
  });
  const pending = await db.submission.groupBy({ by: ["assignmentId"], where: toReview, _count: true });
  const byId = new Map(pending.map((p) => [p.assignmentId, p._count]));
  return rows.map((r) => ({ ...r, pending: byId.get(r.id) ?? 0 }));
}

export async function getAdminAssignment(id: string) {
  return db.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      prompt: true,
      skill: true,
      levelId: true,
      minWords: true,
      maxWords: true,
      maxDurationSec: true,
      status: true,
      level: { select: { code: true } },
      materials: { orderBy: { order: "asc" }, select: { id: true, mediaFile: { select: { id: true, mime: true, originalName: true } } } },
      submissions: {
        where: { status: { not: "DRAFT" } },
        orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
        select: { id: true, status: true, version: true, wordCount: true, durationSec: true, submittedAt: true, user: { select: { name: true } }, feedback: { select: { score: true } } },
      },
    },
  });
}

/** File de correction : copies envoyées, les plus anciennes d'abord. */
export async function listReviewQueue() {
  return db.submission.findMany({
    where: toReview,
    orderBy: { submittedAt: "asc" },
    take: 100,
    select: { id: true, version: true, submittedAt: true, user: { select: { name: true } }, assignment: { select: { title: true, skill: true, level: { select: { code: true } } } } },
  });
}

export async function getSubmissionForReview(id: string) {
  return db.submission.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      version: true,
      text: true,
      audioFileId: true,
      file: { select: { id: true, mime: true, originalName: true } },
      wordCount: true,
      durationSec: true,
      submittedAt: true,
      userId: true,
      user: { select: { id: true, name: true, email: true } },
      assignment: { select: { id: true, title: true, prompt: true, skill: true, minWords: true, maxWords: true, maxDurationSec: true, level: { select: { code: true } } } },
      feedback: { select: { score: true, comment: true, returnedAt: true, reviewer: { select: { name: true } } } },
    },
  });
}
