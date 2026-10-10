import { ArrowLeft, Clock, Eye } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LessonBlocks } from "@/features/learn/components/lesson-blocks";
import { loadLessonContent } from "@/features/learn/queries";
import { PublicationBadge } from "@/features/content/components/publication";
import { Link } from "@/i18n/navigation";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

export const metadata: Metadata = { title: "Aperçu" };

/** Aperçu « vue étudiant » : même rendu que l'espace étudiant, quel que soit le statut de publication. */
export default async function LessonPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const lesson = /^[\w-]{1,64}$/.test(id)
    ? await db.lesson.findUnique({ where: { id }, include: { blocks: { orderBy: { order: "asc" } } } })
    : null;
  if (!lesson) notFound();
  const t = await getTranslations("admin.content");
  const tl = await getTranslations("learn");
  const content = await loadLessonContent(lesson.blocks);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-accent/40 px-4 py-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <Eye className="size-4" aria-hidden /> {t("previewBanner")} <PublicationBadge status={lesson.status} publishAt={lesson.publishAt} />
        </span>
        <Link href={`/admin/content/lessons/${lesson.id}`} className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> {t("backToEditor")}
        </Link>
      </div>
      <header className="space-y-3 border-b pb-6">
        <h1 className="text-3xl leading-tight font-medium sm:text-4xl">{lesson.title}</h1>
        {lesson.summary && <p className="text-lg text-muted-foreground">{lesson.summary}</p>}
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden /> {tl("minutes", { n: lesson.estimatedMinutes })}
        </p>
      </header>
      <LessonBlocks content={content} watermark={admin.email} trackProgress={false} />
      {content.blocks.length < lesson.blocks.length && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">{t("incompleteBlocks", { count: lesson.blocks.length - content.blocks.length })}</p>
      )}
    </div>
  );
}
