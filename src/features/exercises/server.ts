import "server-only";
import { learnerScope } from "@/features/content/access";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { grade, responseSchema, revealAnswer, toPublic, type QuestionType } from "./questions";

/**
 * Exercices côté serveur. Accès étudiant : exercice PUBLIÉ d'un niveau qui lui est accessible
 * (niveau actuel, plus les niveaux validés si le réglage est actif). La correction se fait ici :
 * le navigateur ne reçoit jamais la clé avant l'envoi.
 */
export class ExerciseError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "NO_ATTEMPTS_LEFT" | "ALREADY_SUBMITTED" | "NO_QUESTIONS" | "HAS_ATTEMPTS" | "AUDIO_INVALID") {
    super(code);
  }
}

/** Délai de grâce après la limite de temps (latence réseau, envoi automatique). */
const TIME_GRACE_SEC = 30;

export async function studentExerciseWhere(userId: string): Promise<Prisma.ExerciseWhereInput> {
  const scope = await learnerScope(userId);
  return { status: "PUBLISHED", levelId: { in: scope.levelIds } };
}

export async function listStudentExercises(userId: string) {
  const where = await studentExerciseWhere(userId);
  const exercises = await db.exercise.findMany({
    where,
    orderBy: [{ level: { order: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      instructions: true,
      kind: true,
      passingScore: true,
      maxAttempts: true,
      timeLimitSec: true,
      level: { select: { code: true } },
      _count: { select: { questions: true } },
      attempts: { where: { userId, submittedAt: { not: null } }, select: { score: true, maxScore: true, passed: true } },
    },
  });
  return exercises.map(({ attempts, ...e }) => ({
    ...e,
    attemptsUsed: attempts.length,
    bestPercent: attempts.length ? Math.max(...attempts.map((a) => percent(a.score, a.maxScore))) : null,
    passed: attempts.some((a) => a.passed),
  }));
}

export function percent(score: number | null, max: number | null) {
  return max ? Math.round(((score ?? 0) / max) * 100) : 0;
}

export async function getStudentExercise(userId: string, exerciseId: string) {
  const where = await studentExerciseWhere(userId);
  const exercise = await db.exercise.findFirst({
    where: { ...where, id: exerciseId },
    select: {
      id: true,
      title: true,
      instructions: true,
      kind: true,
      passingScore: true,
      maxAttempts: true,
      timeLimitSec: true,
      shuffle: true,
      level: { select: { code: true } },
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, type: true, prompt: true, payload: true, points: true, audioFileId: true, attachmentFile: { select: { id: true, mime: true, originalName: true } } },
      },
      attempts: {
        where: { userId, submittedAt: { not: null } },
        orderBy: { submittedAt: "desc" },
        select: { id: true, score: true, maxScore: true, passed: true, submittedAt: true },
      },
    },
  });
  if (!exercise) return null;
  return {
    ...exercise,
    questions: exercise.questions.map(({ attachmentFile, ...q }) =>
      toPublic({ ...q, type: q.type as QuestionType, attachment: attachmentFile ? { id: attachmentFile.id, mime: attachmentFile.mime, name: attachmentFile.originalName ?? "" } : null }),
    ),
  };
}

export async function startAttempt(userId: string, exerciseId: string) {
  const where = await studentExerciseWhere(userId);
  const exercise = await db.exercise.findFirst({
    where: { ...where, id: exerciseId },
    select: { id: true, maxAttempts: true, timeLimitSec: true, _count: { select: { questions: true } } },
  });
  if (!exercise) throw new ExerciseError("NOT_FOUND");
  if (exercise._count.questions === 0) throw new ExerciseError("NO_QUESTIONS");
  // Reprend une tentative en cours (rechargement de page) tant que le temps n'est pas écoulé.
  const open = await db.attempt.findFirst({ where: { userId, exerciseId, submittedAt: null }, orderBy: { startedAt: "desc" } });
  if (open && (!exercise.timeLimitSec || Date.now() - open.startedAt.getTime() < exercise.timeLimitSec * 1000)) {
    return { attemptId: open.id, startedAt: open.startedAt.toISOString() };
  }
  const used = await db.attempt.count({ where: { userId, exerciseId, submittedAt: { not: null } } });
  if (exercise.maxAttempts && used >= exercise.maxAttempts) throw new ExerciseError("NO_ATTEMPTS_LEFT");
  const attempt = await db.attempt.create({ data: { userId, exerciseId }, select: { id: true, startedAt: true } });
  return { attemptId: attempt.id, startedAt: attempt.startedAt.toISOString() };
}

export type ReviewItem = {
  questionId: string;
  correct: boolean;
  pointsAwarded: number;
  points: number;
  answer: string[];
  explanation: string | null;
};

export type AttemptResult = { score: number; maxScore: number; percent: number; passed: boolean; review: ReviewItem[] };

export async function submitAttempt(userId: string, attemptId: string, responses: Record<string, unknown>): Promise<AttemptResult> {
  // L'identifiant de tentative vient du navigateur : on vérifie qu'elle appartient bien à cet étudiant.
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      startedAt: true,
      submittedAt: true,
      exercise: {
        select: {
          id: true,
          levelId: true,
          status: true,
          passingScore: true,
          timeLimitSec: true,
          questions: { orderBy: { order: "asc" }, select: { id: true, type: true, payload: true, answerKey: true, points: true, explanation: true } },
        },
      },
    },
  });
  if (!attempt) throw new ExerciseError("NOT_FOUND");
  if (attempt.submittedAt) throw new ExerciseError("ALREADY_SUBMITTED");
  const where = await studentExerciseWhere(userId);
  if (!(await db.exercise.count({ where: { ...where, id: attempt.exercise.id } }))) throw new ExerciseError("NOT_FOUND");

  // Au-delà du temps imparti (+ grâce), les réponses ne sont pas prises en compte.
  const limit = attempt.exercise.timeLimitSec;
  const late = !!limit && Date.now() - attempt.startedAt.getTime() > (limit + TIME_GRACE_SEC) * 1000;

  let score = 0;
  let maxScore = 0;
  const review: ReviewItem[] = [];
  const answers: Prisma.AttemptAnswerCreateManyInput[] = [];
  for (const q of attempt.exercise.questions) {
    const type = q.type as QuestionType;
    const parsed = responseSchema.safeParse(responses[q.id]);
    const response = !late && parsed.success ? parsed.data : null;
    const result = response ? grade(type, q.answerKey, response) : { correct: false, ratio: 0 };
    const pointsAwarded = Math.round(result.ratio * q.points * 100) / 100;
    const rounded = Math.floor(pointsAwarded);
    score += pointsAwarded;
    maxScore += q.points;
    answers.push({ attemptId: attempt.id, questionId: q.id, response: (response ?? {}) as Prisma.InputJsonValue, isCorrect: result.correct, pointsAwarded: rounded });
    review.push({ questionId: q.id, correct: result.correct, pointsAwarded, points: q.points, answer: revealAnswer(type, q.payload, q.answerKey), explanation: q.explanation });
  }
  const finalScore = Math.round(score);
  const pct = percent(finalScore, maxScore);
  const passed = pct >= attempt.exercise.passingScore;
  await db.$transaction([
    db.attemptAnswer.createMany({ data: answers }),
    db.attempt.update({ where: { id: attempt.id }, data: { submittedAt: new Date(), score: finalScore, maxScore, passed } }),
  ]);
  return { score: finalScore, maxScore, percent: pct, passed, review };
}

// ── Back-office ──────────────────────────────────────────────────────────────

export async function listAdminExercises(levelCode?: string) {
  return db.exercise.findMany({
    where: { status: { not: "ARCHIVED" }, ...(levelCode ? { level: { code: levelCode as never } } : {}) },
    orderBy: [{ level: { order: "asc" } }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      updatedAt: true,
      level: { select: { code: true } },
      _count: { select: { questions: true, attempts: { where: { submittedAt: { not: null } } } } },
    },
  });
}

export async function getAdminExercise(id: string) {
  const exercise = await db.exercise.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      instructions: true,
      kind: true,
      levelId: true,
      passingScore: true,
      maxAttempts: true,
      timeLimitSec: true,
      shuffle: true,
      status: true,
      level: { select: { code: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          type: true,
          prompt: true,
          payload: true,
          answerKey: true,
          explanation: true,
          points: true,
          audioFileId: true,
          audioFile: { select: { originalName: true } },
          attachmentFileId: true,
          attachmentFile: { select: { id: true, mime: true, originalName: true } },
        },
      },
    },
  });
  if (!exercise) return null;
  const attempts = await db.attempt.findMany({
    where: { exerciseId: id, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    take: 20,
    select: { id: true, score: true, maxScore: true, passed: true, submittedAt: true, user: { select: { id: true, name: true } } },
  });
  const stats = await db.attempt.aggregate({ where: { exerciseId: id, submittedAt: { not: null } }, _count: true });
  const passedCount = await db.attempt.count({ where: { exerciseId: id, passed: true } });
  const all = await db.attempt.findMany({ where: { exerciseId: id, submittedAt: { not: null } }, select: { score: true, maxScore: true } });
  const average = all.length ? Math.round(all.reduce((s, a) => s + percent(a.score, a.maxScore), 0) / all.length) : null;
  return { exercise, attempts, stats: { count: stats._count, passRate: stats._count ? Math.round((passedCount / stats._count) * 100) : null, average } };
}
