import { ArrowLeft, CheckCircle2, Circle, CircleDot, Clock, FileText, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LEVEL_THEME, type LevelCode } from "@/components/brand/levels";
import { EmptyState } from "@/features/admin-shell/ui";
import { getModuleView, parseLevelParam, parseSkillParam } from "@/features/learn/queries";
import { lessonHref, levelHref, SKILL_ICON } from "@/features/learn/skills";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireApprovedStudent } from "@/server/dal/guards";

export async function generateMetadata({ params }: { params: Promise<{ skill: string }> }): Promise<Metadata> {
  const t = await getTranslations("skills");
  const skill = parseSkillParam((await params).skill);
  return { title: skill ? t(skill) : undefined };
}

export default async function SkillPage({ params }: { params: Promise<{ level: string; skill: string }> }) {
  const viewer = await requireApprovedStudent();
  const p = await params;
  const code = parseLevelParam(p.level);
  const skill = parseSkillParam(p.skill);
  if (!code || !skill) notFound();
  const view = await getModuleView(viewer.userId, code, skill);
  if (!view) notFound();

  const t = await getTranslations("learn");
  const ts = await getTranslations("skills");
  const tl = await getTranslations("levels");
  const theme = LEVEL_THEME[code as LevelCode];
  const Icon = SKILL_ICON[skill];

  return (
    <div className="space-y-8">
      <Link href={levelHref(code)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {code} · {tl(`${code}.name`)}
      </Link>
      <header className="flex items-center gap-4">
        <span className={cn("flex size-14 items-center justify-center rounded-2xl", theme.soft)}>
          <Icon className={cn("size-7", theme.text)} aria-hidden />
        </span>
        <div>
          <h1 className="text-3xl font-medium sm:text-4xl">{ts(skill)}</h1>
          <p className="text-muted-foreground">{view.module.description}</p>
        </div>
      </header>

      {view.module.units.length === 0 ? (
        <EmptyState icon={<FileText className="size-5" aria-hidden />} title={t("noUnits")} body={t("noUnitsBody")} />
      ) : (
        <ol className="grid gap-6">
          {view.module.units.map((unit, ui) => (
            <li key={unit.id} className="rounded-2xl border bg-card">
              <div className="border-b px-6 py-4">
                <p className={cn("text-xs font-semibold tracking-widest uppercase", theme.text)}>{t("unitNumber", { n: ui + 1 })}</p>
                <h2 className="text-xl">{unit.title}</h2>
                {unit.summary && <p className="text-sm text-muted-foreground">{unit.summary}</p>}
              </div>
              <ol className="divide-y">
                {unit.lessons.map((lesson) => {
                  const status = lesson.progress[0]?.status;
                  const StatusIcon = status === "COMPLETED" ? CheckCircle2 : status === "IN_PROGRESS" ? CircleDot : Circle;
                  const TypeIcon = lesson.type === "VIDEO" ? PlayCircle : FileText;
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={lessonHref(code, skill, unit.slug, lesson.slug)}
                        className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-accent/60"
                      >
                        <StatusIcon
                          className={cn("size-5 shrink-0", status === "COMPLETED" ? "text-success" : status ? "text-gold-ink" : "text-muted-foreground")}
                          aria-label={t(`status.${status ?? "NOT_STARTED"}`)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{lesson.title}</span>
                          {lesson.summary && <span className="block truncate text-sm text-muted-foreground">{lesson.summary}</span>}
                        </span>
                        <span className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                          <TypeIcon className="size-4" aria-label={t(`type.${lesson.type}`)} />
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden /> {t("minutes", { n: lesson.estimatedMinutes })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
