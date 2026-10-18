"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { confirmUpload, MediaError, requestUpload } from "@/features/media/service";
import { audit, type AuditContext } from "@/server/audit";
import { createAction, fail, type ActionResult } from "@/server/actions";
import { db } from "@/server/db";
import { assertAdmin, assertApprovedStudent } from "@/server/dal/guards";
import { AssignmentError, saveDraft, studentAssignmentWhere, submitDraft } from "./server";

const id = z.string().min(1).max(64);

async function admin(): Promise<AuditContext> {
  const a = await assertAdmin();
  return { actorId: a.userId, ip: a.ip, userAgent: a.userAgent };
}

async function run<T>(op: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await op() };
  } catch (err) {
    if (err instanceof AssignmentError || err instanceof MediaError) return fail(err.code);
    throw err;
  }
}

function refreshAdmin(assignmentId?: string) {
  revalidatePath("/[locale]/admin/assignments", "layout");
  if (assignmentId) revalidatePath(`/[locale]/admin/assignments/${assignmentId}`, "page");
}

// ── Back-office : devoirs ──

const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().int().min(min, "numberInvalid").max(max, "numberInvalid").optional());

const assignmentFields = z
  .object({
    title: z.string().trim().min(3, "titleTooShort").max(150, "titleTooLong"),
    prompt: z.string().trim().min(10, "promptTooShort").max(5000, "descriptionTooLong"),
    levelId: id,
    skill: z.enum(["WRITING", "SPEAKING"]),
    minWords: optionalInt(1, 5000),
    maxWords: optionalInt(1, 5000),
    maxDurationMin: optionalInt(1, 30),
  })
  .refine((a) => !a.minWords || !a.maxWords || a.minWords <= a.maxWords, { path: ["maxWords"], message: "rangeInvalid" });

function assignmentData(input: z.infer<typeof assignmentFields>) {
  const writing = input.skill === "WRITING";
  return {
    title: input.title,
    prompt: input.prompt,
    levelId: input.levelId,
    skill: input.skill,
    minWords: writing ? (input.minWords ?? null) : null,
    maxWords: writing ? (input.maxWords ?? null) : null,
    maxDurationSec: !writing && input.maxDurationMin ? input.maxDurationMin * 60 : null,
  };
}

export const createAssignmentAction = createAction(assignmentFields, async (input): Promise<ActionResult<string>> => {
  const actor = await admin();
  if (!(await db.level.count({ where: { id: input.levelId } }))) return fail("validation", { levelId: ["required"] });
  const assignment = await db.assignment.create({ data: assignmentData(input), select: { id: true } });
  await audit(actor, "assignment.create", { type: "Assignment", id: assignment.id }, { title: input.title });
  refreshAdmin();
  return { ok: true, data: assignment.id };
});

export const updateAssignmentAction = createAction(
  z.intersection(assignmentFields, z.object({ id })),
  async ({ id: assignmentId, ...input }) => {
    const actor = await admin();
    if (!(await db.assignment.count({ where: { id: assignmentId } }))) return fail("NOT_FOUND");
    await db.assignment.update({ where: { id: assignmentId }, data: assignmentData(input) });
    await audit(actor, "assignment.update", { type: "Assignment", id: assignmentId });
    refreshAdmin(assignmentId);
    return { ok: true };
  },
);

export const setAssignmentStatusAction = createAction(z.object({ id, status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }), async ({ id: assignmentId, status }) => {
  const actor = await admin();
  const updated = await db.assignment.updateMany({ where: { id: assignmentId }, data: { status } });
  if (!updated.count) return fail("NOT_FOUND");
  await audit(actor, "assignment.status", { type: "Assignment", id: assignmentId }, { status });
  refreshAdmin(assignmentId);
  return { ok: true };
});

export const deleteAssignmentAction = createAction(z.object({ id }), async ({ id: assignmentId }) => {
  const actor = await admin();
  // Les copies des étudiants sont conservées : un devoir déjà rendu s'archive.
  if (await db.submission.count({ where: { assignmentId, status: { not: "DRAFT" } } })) return fail("HAS_SUBMISSIONS");
  const deleted = await db.assignment.deleteMany({ where: { id: assignmentId } });
  if (!deleted.count) return fail("NOT_FOUND");
  await audit(actor, "assignment.delete", { type: "Assignment", id: assignmentId });
  refreshAdmin();
  return { ok: true };
});

export const reviewSubmissionAction = createAction(
  z.object({
    submissionId: id,
    score: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0, "numberInvalid").max(100, "numberInvalid").optional()),
    comment: z.string().trim().min(1, "required").max(5000, "descriptionTooLong"),
  }),
  async ({ submissionId, score, comment }) => {
    const actor = await admin();
    const submission = await db.submission.findUnique({ where: { id: submissionId }, select: { status: true, assignmentId: true, userId: true } });
    if (!submission || submission.status === "DRAFT") return fail("NOT_FOUND");
    const now = new Date();
    await db.$transaction([
      db.feedback.upsert({
        where: { submissionId },
        create: { submissionId, reviewerId: actor.actorId, score: score ?? null, comment, returnedAt: now },
        update: { reviewerId: actor.actorId, score: score ?? null, comment, returnedAt: now },
      }),
      db.submission.update({ where: { id: submissionId }, data: { status: "RETURNED" } }),
      db.notification.create({ data: { userId: submission.userId, type: "submission.returned", payload: { assignmentId: submission.assignmentId } } }),
    ]);
    await audit(actor, "submission.review", { type: "Submission", id: submissionId }, { score: score ?? null });
    refreshAdmin(submission.assignmentId);
    return { ok: true };
  },
);

// ── Étudiant : copie ──

export const saveDraftAction = createAction(
  z.object({
    assignmentId: id,
    text: z.string().max(40_000, "descriptionTooLong").optional(),
    audioFileId: id.nullable().optional(),
    durationSec: z.number().int().min(0).max(3600).optional(),
    fileId: id.nullable().optional(),
  }),
  async ({ assignmentId, ...input }) => {
    const viewer = await assertApprovedStudent({ mutation: true });
    return run(async () => {
      await saveDraft(viewer.userId, assignmentId, input);
    });
  },
);

export const submitAssignmentAction = createAction(z.object({ assignmentId: id }), async ({ assignmentId }) => {
  const viewer = await assertApprovedStudent({ mutation: true });
  const result = await run(() => submitDraft(viewer.userId, assignmentId));
  revalidatePath("/[locale]/app/assignments", "layout");
  revalidatePath("/[locale]/admin", "layout");
  return result;
});

/** Enregistrement vocal : URL d'envoi signée, fichier rattaché à l'étudiant. */
export const requestRecordingUploadAction = createAction(
  z.object({ assignmentId: id, mime: z.string().max(100), size: z.number().int().positive() }),
  async ({ assignmentId, mime, size }) => {
    const viewer = await assertApprovedStudent({ mutation: true });
    return run(async () => {
      const where = await studentAssignmentWhere(viewer.userId);
      if (!(await db.assignment.count({ where: { ...where, id: assignmentId, skill: "SPEAKING" } }))) throw new AssignmentError("NOT_FOUND");
      const baseMime = mime.split(";")[0]!.trim();
      return requestUpload(
        { actorId: viewer.userId, ip: viewer.ip, userAgent: viewer.userAgent },
        { purpose: "SUBMISSION_AUDIO", mime: baseMime, size, name: `recording-${assignmentId}`, ownerUserId: viewer.userId },
      );
    });
  },
);

/** Copie rendue sous forme de fichier (Word, PDF, PowerPoint, photo ou capture de son travail). */
export const requestSubmissionFileUploadAction = createAction(
  z.object({ assignmentId: id, mime: z.string().max(100), size: z.number().int().positive(), name: z.string().max(255) }),
  async ({ assignmentId, mime, size, name }) => {
    const viewer = await assertApprovedStudent({ mutation: true });
    return run(async () => {
      const where = await studentAssignmentWhere(viewer.userId);
      if (!(await db.assignment.count({ where: { ...where, id: assignmentId } }))) throw new AssignmentError("NOT_FOUND");
      return requestUpload(
        { actorId: viewer.userId, ip: viewer.ip, userAgent: viewer.userAgent },
        { purpose: "SUBMISSION_FILE", mime, size, name, ownerUserId: viewer.userId },
      );
    });
  },
);

export const confirmSubmissionFileUploadAction = createAction(z.object({ mediaId: id }), async ({ mediaId }) => {
  const viewer = await assertApprovedStudent({ mutation: true });
  return run(async () => {
    // Un étudiant ne confirme que ses propres fichiers.
    const media = await db.mediaFile.findFirst({ where: { id: mediaId, ownerUserId: viewer.userId, purpose: "SUBMISSION_FILE" }, select: { id: true } });
    if (!media) throw new AssignmentError("ATTACHMENT_INVALID");
    const m = await confirmUpload({ actorId: viewer.userId, ip: viewer.ip, userAgent: viewer.userAgent }, mediaId);
    return { id: m.id, name: m.originalName ?? "", mime: m.mime };
  });
});

// ── Back-office : documents joints à la consigne ──

export const addAssignmentMaterialAction = createAction(z.object({ assignmentId: id, mediaId: id }), async ({ assignmentId, mediaId }) => {
  const actor = await admin();
  const [assignment, media] = await Promise.all([
    db.assignment.findUnique({ where: { id: assignmentId }, select: { id: true } }),
    db.mediaFile.findFirst({
      where: { id: mediaId, purpose: { in: ["LESSON_DOCUMENT", "LESSON_IMAGE", "LESSON_AUDIO"] }, uploadedAt: { not: null } },
      select: { id: true },
    }),
  ]);
  if (!assignment || !media) return fail("NOT_FOUND");
  const last = await db.assignmentMaterial.aggregate({ where: { assignmentId }, _max: { order: true } });
  await db.assignmentMaterial.upsert({
    where: { assignmentId_mediaFileId: { assignmentId, mediaFileId: mediaId } },
    create: { assignmentId, mediaFileId: mediaId, order: (last._max.order ?? -1) + 1 },
    update: {},
  });
  await audit(actor, "assignment.update", { type: "Assignment", id: assignmentId }, { materialAdded: mediaId });
  refreshAdmin(assignmentId);
  return { ok: true };
});

export const removeAssignmentMaterialAction = createAction(z.object({ assignmentId: id, materialId: id }), async ({ assignmentId, materialId }) => {
  const actor = await admin();
  const deleted = await db.assignmentMaterial.deleteMany({ where: { id: materialId, assignmentId } });
  if (!deleted.count) return fail("NOT_FOUND");
  await audit(actor, "assignment.update", { type: "Assignment", id: assignmentId }, { materialRemoved: materialId });
  refreshAdmin(assignmentId);
  return { ok: true };
});

export const confirmRecordingUploadAction = createAction(z.object({ mediaId: id }), async ({ mediaId }) => {
  const viewer = await assertApprovedStudent({ mutation: true });
  return run(async () => {
    // Un étudiant ne confirme que ses propres fichiers.
    const media = await db.mediaFile.findFirst({ where: { id: mediaId, ownerUserId: viewer.userId, purpose: "SUBMISSION_AUDIO" }, select: { id: true } });
    if (!media) throw new AssignmentError("AUDIO_INVALID");
    const confirmed = await confirmUpload({ actorId: viewer.userId, ip: viewer.ip, userAgent: viewer.userAgent }, mediaId);
    return confirmed.id;
  });
});
