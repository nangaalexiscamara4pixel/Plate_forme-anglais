import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelBadge } from "@/features/admin-shell/ui";
import { deleteExerciseAction, setExerciseStatusAction } from "@/features/exercises/actions";
import { ExerciseForm } from "@/features/exercises/components/exercise-form";
import { PublishBar } from "@/features/exercises/components/publish-bar";
import { QuestionsEditor } from "@/features/exercises/components/questions-editor";
import { revealAnswer, toInput, type QuestionType } from "@/features/exercises/questions";
import { getAdminExercise, percent } from "@/features/exercises/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const exercise = await db.exercise.findUnique({ where: { id }, select: { title: true } });
  return { title: exercise?.title ?? "—" };
}

/** Éditeur d'exercice : paramètres, questions, publication et résultats des étudiants. */
export default async function AdminExercisePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await getAdminExercise(id);
  if (!data) notFound();
  const { exercise, attempts, stats } = data;
  const t = await getTranslations("exercises.admin");
  const format = await getFormatter();
  const levels = await db.level.findMany({ orderBy: { order: "asc" }, select: { id: true, code: true, name: true } });

  const questions = exercise.questions.map((q) => {
    const type = q.type as QuestionType;
    return { id: q.id, type, prompt: q.prompt, points: q.points, input: toInput({ ...q, type }), answer: revealAnswer(type, q.payload, q.answerKey), audioName: q.audioFile?.originalName ?? null };
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/exercises" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> {t("back")}
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {exercise.level && <LevelBadge code={exercise.level.code} />} {t(`kinds.${exercise.kind}`)}
            </p>
            <h1 className="text-3xl font-medium">{exercise.title}</h1>
          </div>
          <PublishBar
            id={exercise.id}
            status={exercise.status}
            setStatus={setExerciseStatusAction}
            remove={deleteExerciseAction}
            afterDelete="/admin/exercises"
            confirmDelete={t("confirmDelete", { title: exercise.title })}
          />
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
        <QuestionsEditor exerciseId={exercise.id} questions={questions} />
        <div className="grid h-fit gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-sans text-base">{t("results")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  [t("attempts"), stats.count],
                  [t("average"), stats.average === null ? "—" : `${stats.average} %`],
                  [t("passRate"), stats.passRate === null ? "—" : `${stats.passRate} %`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-muted/60 p-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-display text-xl tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {attempts.length > 0 && (
                <ul className="divide-y text-sm">
                  {attempts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/admin/students/${a.user.id}`} className="truncate hover:underline">
                        {a.user.name}
                      </Link>
                      <span className={cn("shrink-0 tabular-nums", a.passed ? "text-success" : "text-muted-foreground")}>
                        {percent(a.score, a.maxScore)} % · {a.submittedAt && format.dateTime(a.submittedAt, { dateStyle: "short" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-sans text-base">{t("settings")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ExerciseForm levels={levels} exercise={exercise} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
