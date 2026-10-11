import { ArrowRight, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LEVEL_THEME, type LevelCode } from "@/components/brand/levels";
import { listStudentExercises } from "@/features/exercises/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireApprovedStudent } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("exercises.student");
  return { title: t("title") };
}

/** Exercices publiés des niveaux accessibles, avec le meilleur score de l'étudiant. */
export default async function StudentExercisesPage() {
  const viewer = await requireApprovedStudent();
  const t = await getTranslations("exercises.student");
  const tk = await getTranslations("exercises.admin.kinds");
  const exercises = await listStudentExercises(viewer.userId);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-medium sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </section>
      {exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
          <ClipboardList className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
          <p className="font-display text-xl">{t("emptyTitle")}</p>
          <p className="mt-1 text-muted-foreground">{t("emptyText")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {exercises.map((e) => {
            const theme = e.level ? LEVEL_THEME[e.level.code as LevelCode] : null;
            return (
              <li key={e.id}>
                <Link href={`/app/exercises/${e.id}`} className="group flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="mb-3 flex items-center gap-2 text-xs">
                    {e.level && <span className={cn("rounded-full px-2 py-0.5 font-semibold text-white", theme?.bg)}>{e.level.code}</span>}
                    <span className="text-muted-foreground">{tk(e.kind)}</span>
                    {e.passed && (
                      <span className="ml-auto inline-flex items-center gap-1 font-semibold text-success">
                        <CheckCircle2 className="size-4" aria-hidden /> {t("passed")}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-xl">{e.title}</h2>
                  {e.instructions && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.instructions}</p>}
                  <div className="mt-auto flex items-center gap-4 pt-4 text-sm text-muted-foreground">
                    <span>{t("questions", { count: e._count.questions })}</span>
                    {e.timeLimitSec && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden /> {t("minutes", { count: Math.round(e.timeLimitSec / 60) })}
                      </span>
                    )}
                    <span className="ml-auto font-medium text-foreground">
                      {e.bestPercent === null ? t("notStarted") : t("best", { score: e.bestPercent })}
                    </span>
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
