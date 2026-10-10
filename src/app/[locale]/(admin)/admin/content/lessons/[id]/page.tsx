import { ArrowLeft, Eye } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/features/admin-shell/ui";
import { getLessonEditor } from "@/features/content/admin-queries";
import { BlocksEditor } from "@/features/content/components/blocks-editor";
import { LessonSettings } from "@/features/content/components/lesson-settings";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/server/dal/guards";

export const metadata: Metadata = { title: "Leçon" };

export default async function LessonEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) notFound();
  const data = await getLessonEditor(id);
  if (!data) notFound();
  const { lesson, videos, media } = data;
  const t = await getTranslations("admin.content");
  const ts = await getTranslations("skills");
  const level = lesson.unit.module.level;
  const skill = lesson.unit.module.skill;

  return (
    <>
      <Link
        href={`/admin/content/${level.code.toLowerCase()}/${skill.toLowerCase()}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> {level.code} · {ts(skill)} · {lesson.unit.title}
      </Link>
      <PageHeader
        title={lesson.title}
        description={t("lessonHelp")}
        actions={
          <Button asChild variant="outline">
            <Link href={`/admin/content/lessons/${lesson.id}/preview`}>
              <Eye className="size-4" aria-hidden /> {t("preview")}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <section aria-label={t("blocks")} className="min-w-0">
          <BlocksEditor
            lessonId={lesson.id}
            blocks={lesson.blocks.map((b) => ({ id: b.id, kind: b.kind, content: (b.content ?? {}) as Record<string, unknown>, videoId: b.videoId }))}
            videos={videos}
            mediaNames={Object.fromEntries(media.map((m) => [m.id, m.originalName ?? m.id]))}
          />
        </section>
        <aside>
          <Card className="xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle className="font-sans text-base">{t("lessonSettings")}</CardTitle>
            </CardHeader>
            <CardContent>
              <LessonSettings lesson={lesson} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
