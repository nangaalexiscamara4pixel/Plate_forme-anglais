import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExercisePlayer } from "@/features/exercises/components/exercise-player";
import { getStudentExercise, percent } from "@/features/exercises/server";
import { requireApprovedStudent } from "@/server/dal/guards";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Exercice : 404 s'il n'est pas publié ou d'un niveau inaccessible (sans révéler son existence). */
export default async function StudentExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireApprovedStudent();
  const { id } = await params;
  const exercise = await getStudentExercise(viewer.userId, id);
  if (!exercise) notFound();
  const used = exercise.attempts.length;
  return (
    <ExercisePlayer
      exercise={{
        id: exercise.id,
        title: exercise.title,
        instructions: exercise.instructions,
        levelCode: exercise.level?.code ?? "",
        passingScore: exercise.passingScore,
        timeLimitSec: exercise.timeLimitSec,
        shuffle: exercise.shuffle,
        questions: exercise.questions,
        attemptsLeft: exercise.maxAttempts ? Math.max(0, exercise.maxAttempts - used) : null,
        bestPercent: used ? Math.max(...exercise.attempts.map((a) => percent(a.score, a.maxScore))) : null,
      }}
    />
  );
}
