import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/features/admin-shell/ui";
import { getVideoEditor } from "@/features/content/admin-queries";
import { VideoDetailsForm } from "@/features/content/components/video-details-form";
import { LessonVideoPlayer } from "@/features/learn/components/video-player";
import { chaptersToText, cuesToVttText, type Chapter, type Cue } from "@/features/video/captions";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/server/dal/guards";
import { playbackSource } from "@/server/video";

export const metadata: Metadata = { title: "Vidéo" };

export default async function VideoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const video = /^[\w-]{1,64}$/.test(id) ? await getVideoEditor(id) : null;
  if (!video) notFound();
  const t = await getTranslations("admin.media");
  const track = (lang: string) => (video.tracks.find((tr) => tr.lang === lang && tr.kind === "SUBTITLES")?.cues as Cue[] | undefined) ?? [];
  const chapters = (video.chapters as Chapter[] | null) ?? [];

  return (
    <>
      <Link href="/admin/media" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t("title")}
      </Link>
      <PageHeader title={video.title} description={`${video.provider === "MUX" ? "Mux" : t("localVideo")} · ${t(`videoStatus.${video.status}`)}`} />
      <div className="grid gap-6 xl:grid-cols-2">
        <LessonVideoPlayer
          video={{
            id: video.id,
            title: video.title,
            chapters,
            captions: video.tracks.filter((tr) => tr.kind === "SUBTITLES").map((tr) => tr.lang),
            source: await playbackSource(video),
          }}
          watermark={admin.email}
          trackProgress={false}
        />
        <Card>
          <CardContent className="pt-6">
            <VideoDetailsForm
              video={{
                id: video.id,
                title: video.title,
                chapters: chaptersToText(chapters),
                subtitlesEn: cuesToVttText(track("en")),
                subtitlesFr: cuesToVttText(track("fr")),
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
