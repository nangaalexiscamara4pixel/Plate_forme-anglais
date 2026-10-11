import { ArrowRight, Mic, NotebookPen, PenLine } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LEVEL_THEME, type LevelCode } from "@/components/brand/levels";
import { listStudentAssignments } from "@/features/assignments/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireApprovedStudent } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assignments.student");
  return { title: t("title") };
}

const STATUS_STYLE = {
  TODO: "bg-muted text-muted-foreground",
  DRAFT: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  SUBMITTED: "bg-brand/10 text-brand-ink",
  IN_REVIEW: "bg-brand/10 text-brand-ink",
  RETURNED: "bg-success/15 text-success",
} as const;

/** Devoirs publiés des niveaux de l'étudiant, avec l'état de sa copie. */
export default async function StudentAssignmentsPage() {
  const viewer = await requireApprovedStudent();
  const t = await getTranslations("assignments.student");
  const assignments = await listStudentAssignments(viewer.userId);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-medium sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </section>
      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
          <NotebookPen className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
          <p className="font-display text-xl">{t("emptyTitle")}</p>
          <p className="mt-1 text-muted-foreground">{t("emptyText")}</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {assignments.map((a) => {
            const status = a.latest?.status ?? "TODO";
            const theme = a.level ? LEVEL_THEME[a.level.code as LevelCode] : null;
            const Icon = a.skill === "WRITING" ? PenLine : Mic;
            return (
              <li key={a.id}>
                <Link href={`/app/assignments/${a.id}`} className="group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl text-white", theme?.bg ?? "bg-night")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {a.level?.code} · {t(`skills.${a.skill}`)}
                    </p>
                    <h2 className="truncate font-display text-lg">{a.title}</h2>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[status])}>
                    {status === "RETURNED" && a.latest?.feedback?.score != null ? `${a.latest.feedback.score}/100` : t(`status.${status}`)}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
