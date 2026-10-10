import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CompleteLessonButton } from "@/features/learn/components/complete-button";
import { LessonBlocks } from "@/features/learn/components/lesson-blocks";
import { getLessonView, parseLevelParam, parseSkillParam, touchLesson } from "@/features/learn/queries";
import { lessonHref, skillHref } from "@/features/learn/skills";
import { Link } from "@/i18n/navigation";
import { requireApprovedStudent } from "@/server/dal/guards";

type Params = Promise<{ level: string; skill: string; unit: string; lesson: string }>;

async function load(params: Params) {
  const viewer = await requireApprovedStudent();
  const p = await params;
  const code = parseLevelParam(p.level);
  const skill = parseSkillParam(p.skill);
  if (!code || !skill || !/^[a-z0-9-]{1,64}$/.test(p.unit) || !/^[a-z0-9-]{1,64}$/.test(p.lesson)) notFound();
  const view = await getLessonView(viewer.userId, code, skill, p.unit, p.lesson);
  if (!view) notFound();
  return { viewer, view, code, skill };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { view } = await load(params);
  return { title: view.lesson.title };
}

export default async function LessonPage({ params }: { params: Params }) {
  const { viewer, view, code, skill } = await load(params);
  const readOnly = Boolean(viewer.impersonatedBy);
  // L'ouverture marque la leçon « en cours » (sauf en mode consultation administrateur).
  if (!readOnly && !view.progress) await touchLesson(viewer.userId, view.lesson.id);

  const t = await getTranslations("learn");
  const ts = await getTranslations("skills");

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <nav className="flex items-center justify-between text-sm text-muted-foreground">
        <Link href={skillHref(code, skill)} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> {ts(skill)} · {view.unit.title}
        </Link>
        <span>{t("lessonPosition", { index: view.position.index, total: view.position.total })}</span>
      </nav>

      <header className="space-y-3 border-b pb-6">
        <h1 className="text-3xl leading-tight font-medium sm:text-4xl">{view.lesson.title}</h1>
        {view.lesson.summary && <p className="text-lg text-muted-foreground">{view.lesson.summary}</p>}
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden /> {t("minutes", { n: view.lesson.estimatedMinutes })}
        </p>
      </header>

      <LessonBlocks
        content={view.content}
        lessonId={view.lesson.id}
        videoStartAt={view.progress?.videoPositionSec ?? 0}
        watermark={viewer.email}
        trackProgress={!readOnly}
      />

      <footer className="flex flex-col gap-6 border-t pt-8">
        <CompleteLessonButton lessonId={view.lesson.id} completed={view.progress?.status === "COMPLETED"} readOnly={readOnly} />
        <div className="flex flex-wrap justify-between gap-3">
          {view.previous ? (
            <Button asChild variant="outline">
              <Link href={lessonHref(code, skill, view.previous.unitSlug, view.previous.slug)}>
                <ArrowLeft className="size-4" aria-hidden /> {view.previous.title}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {view.next && (
            <Button asChild>
              <Link href={lessonHref(code, skill, view.next.unitSlug, view.next.slug)}>
                {view.next.title} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}
