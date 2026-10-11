"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, type AuditContext } from "@/server/audit";
import { createAction, fail, type ActionResult } from "@/server/actions";
import { db } from "@/server/db";
import { assertAdmin, assertApprovedStudent } from "@/server/dal/guards";
import { questionInputSchema, toStored } from "./questions";
import { ExerciseError, startAttempt, submitAttempt, type AttemptResult } from "./server";

const id = z.string().min(1).max(64);

async function admin(): Promise<AuditContext> {
  const a = await assertAdmin();
  return { actorId: a.userId, ip: a.ip, userAgent: a.userAgent };
}

async function run<T>(op: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await op() };
  } catch (err) {
    if (err instanceof ExerciseError) return fail(err.code);
    throw err;
  }
}

function refresh(exerciseId?: string) {
  revalidatePath("/[locale]/admin/exercises", "page");
  if (exerciseId) revalidatePath(`/[locale]/admin/exercises/${exerciseId}`, "page");
}

// ── Back-office : exercices ──

const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().int().min(min, "numberInvalid").max(max, "numberInvalid").optional());

const exerciseFields = z.object({
  title: z.string().trim().min(3, "titleTooShort").max(150, "titleTooLong"),
  instructions: z.string().trim().max(2000, "descriptionTooLong").optional().or(z.literal("").transform(() => undefined)),
  levelId: id,
  kind: z.enum(["PRACTICE", "UNIT_QUIZ", "LEVEL_EXAM"]),
  passingScore: z.coerce.number().int().min(0, "numberInvalid").max(100, "numberInvalid"),
  maxAttempts: optionalInt(1, 50),
  timeLimitMin: optionalInt(1, 240),
  shuffle: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
});

function exerciseData(input: z.infer<typeof exerciseFields>) {
  return {
    title: input.title,
    instructions: input.instructions ?? null,
    levelId: input.levelId,
    kind: input.kind,
    passingScore: input.passingScore,
    maxAttempts: input.maxAttempts ?? null,
    timeLimitSec: input.timeLimitMin ? input.timeLimitMin * 60 : null,
    shuffle: input.shuffle,
  };
}

export const createExerciseAction = createAction(exerciseFields, async (input): Promise<ActionResult<string>> => {
  const actor = await admin();
  if (!(await db.level.count({ where: { id: input.levelId } }))) return fail("validation", { levelId: ["required"] });
  const exercise = await db.exercise.create({ data: exerciseData(input), select: { id: true } });
  await audit(actor, "exercise.create", { type: "Exercise", id: exercise.id }, { title: input.title });
  refresh();
  return { ok: true, data: exercise.id };
});

export const updateExerciseAction = createAction(exerciseFields.extend({ id }), async ({ id: exerciseId, ...input }) => {
  const actor = await admin();
  if (!(await db.exercise.count({ where: { id: exerciseId } }))) return fail("NOT_FOUND");
  await db.exercise.update({ where: { id: exerciseId }, data: exerciseData(input) });
  await audit(actor, "exercise.update", { type: "Exercise", id: exerciseId });
  refresh(exerciseId);
  return { ok: true };
});

export const setExerciseStatusAction = createAction(z.object({ id, status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }), async ({ id: exerciseId, status }) => {
  const actor = await admin();
  const exercise = await db.exercise.findUnique({ where: { id: exerciseId }, select: { _count: { select: { questions: true } } } });
  if (!exercise) return fail("NOT_FOUND");
  if (status === "PUBLISHED" && exercise._count.questions === 0) return fail("NO_QUESTIONS");
  await db.exercise.update({ where: { id: exerciseId }, data: { status } });
  await audit(actor, "exercise.status", { type: "Exercise", id: exerciseId }, { status });
  refresh(exerciseId);
  return { ok: true };
});

export const deleteExerciseAction = createAction(z.object({ id }), async ({ id: exerciseId }) => {
  const actor = await admin();
  // Les résultats des étudiants sont conservés : un exercice déjà tenté s'archive, il ne se supprime pas.
  if (await db.attempt.count({ where: { exerciseId, submittedAt: { not: null } } })) return fail("HAS_ATTEMPTS");
  const deleted = await db.exercise.deleteMany({ where: { id: exerciseId } });
  if (!deleted.count) return fail("NOT_FOUND");
  await audit(actor, "exercise.delete", { type: "Exercise", id: exerciseId });
  refresh();
  return { ok: true };
});

// ── Back-office : questions ──

export const saveQuestionAction = createAction(
  z.object({ exerciseId: id, questionId: id.optional(), question: questionInputSchema }),
  async ({ exerciseId, questionId, question }) => {
    const actor = await admin();
    if (!(await db.exercise.count({ where: { id: exerciseId } }))) return fail("NOT_FOUND");
    const stored = toStored(question);
    if (stored.audioFileId) {
      const audio = await db.mediaFile.findFirst({ where: { id: stored.audioFileId, purpose: "LESSON_AUDIO", uploadedAt: { not: null } }, select: { id: true } });
      if (!audio) return fail("AUDIO_INVALID");
    }
    const data = {
      type: stored.type,
      prompt: stored.prompt,
      payload: stored.payload as object,
      answerKey: stored.answerKey as object,
      explanation: stored.explanation,
      points: stored.points,
      audioFileId: stored.audioFileId,
    };
    if (questionId) {
      const updated = await db.question.updateMany({ where: { id: questionId, exerciseId }, data });
      if (!updated.count) return fail("NOT_FOUND");
    } else {
      const last = await db.question.aggregate({ where: { exerciseId }, _max: { order: true } });
      await db.question.create({ data: { ...data, exerciseId, order: (last._max.order ?? -1) + 1 } });
    }
    await audit(actor, "exercise.question.save", { type: "Exercise", id: exerciseId }, { type: stored.type });
    refresh(exerciseId);
    return { ok: true };
  },
);

export const deleteQuestionAction = createAction(z.object({ exerciseId: id, questionId: id }), async ({ exerciseId, questionId }) => {
  const actor = await admin();
  const deleted = await db.question.deleteMany({ where: { id: questionId, exerciseId } });
  if (!deleted.count) return fail("NOT_FOUND");
  await audit(actor, "exercise.question.delete", { type: "Exercise", id: exerciseId });
  refresh(exerciseId);
  return { ok: true };
});

export const moveQuestionAction = createAction(z.object({ exerciseId: id, questionId: id, direction: z.enum(["up", "down"]) }), async ({ exerciseId, questionId, direction }) => {
  await admin();
  const questions = await db.question.findMany({ where: { exerciseId }, orderBy: { order: "asc" }, select: { id: true } });
  const i = questions.findIndex((q) => q.id === questionId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= questions.length) return { ok: true };
  [questions[i], questions[j]] = [questions[j]!, questions[i]!];
  await db.$transaction(questions.map((q, order) => db.question.update({ where: { id: q.id }, data: { order } })));
  refresh(exerciseId);
  return { ok: true };
});

// ── Étudiant : tentatives ──

export const startAttemptAction = createAction(z.object({ exerciseId: id }), async ({ exerciseId }) => {
  const viewer = await assertApprovedStudent({ mutation: true });
  return run(() => startAttempt(viewer.userId, exerciseId));
});

export const submitAttemptAction = createAction(
  z.object({ attemptId: id, responses: z.record(z.string().max(64), z.unknown()).refine((r) => Object.keys(r).length <= 200) }),
  async ({ attemptId, responses }): Promise<ActionResult<AttemptResult>> => {
    const viewer = await assertApprovedStudent({ mutation: true });
    const result = await run(() => submitAttempt(viewer.userId, attemptId, responses));
    revalidatePath("/[locale]/app/exercises", "page");
    return result;
  },
);
