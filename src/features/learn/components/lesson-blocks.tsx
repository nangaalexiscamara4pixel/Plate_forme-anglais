import { BookMarked, Globe2, Info, Lightbulb, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RichText } from "@/components/rich-text";
import type { RenderableBlock } from "@/features/content/blocks";
import { cn } from "@/lib/utils";
import type { LessonContent } from "../queries";
import { LessonVideoPlayer } from "./video-player";
import { VocabList } from "./vocab-list";

const CALLOUT_STYLE = {
  info: { icon: Info, cls: "border-level-a2/40 bg-level-a2/5 [&_.callout-icon]:text-level-a2" },
  tip: { icon: Lightbulb, cls: "border-brand/50 bg-brand/10 [&_.callout-icon]:text-brand-ink" },
  warning: { icon: TriangleAlert, cls: "border-warning/50 bg-warning/10 [&_.callout-icon]:text-warning" },
  culture: { icon: Globe2, cls: "border-level-b1/40 bg-level-b1/5 [&_.callout-icon]:text-level-b1" },
  grammar: { icon: BookMarked, cls: "border-level-a1/40 bg-level-a1/5 [&_.callout-icon]:text-level-a1" },
} as const;

/**
 * Rendu des blocs d'une leçon (vue étudiant et aperçu administrateur).
 * Les fichiers passent toujours par /api/media/[id], qui vérifie les droits.
 */
export async function LessonBlocks({
  content,
  lessonId,
  videoStartAt = 0,
  watermark,
  trackProgress,
}: {
  content: LessonContent;
  lessonId?: string;
  videoStartAt?: number;
  watermark?: string;
  trackProgress: boolean;
}) {
  const t = await getTranslations("learn.blocks");
  const render = (block: RenderableBlock) => {
    switch (block.kind) {
      case "RICH_TEXT":
        return <RichText doc={block.content.doc} />;
      case "CALLOUT": {
        const style = CALLOUT_STYLE[block.content.tone];
        const Icon = style.icon;
        return (
          <aside className={cn("rounded-xl border-l-4 px-5 py-4", style.cls)}>
            <p className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold tracking-wide uppercase">
              <Icon className="callout-icon size-4" aria-hidden />
              {block.content.title || t(`tone.${block.content.tone}`)}
            </p>
            <RichText doc={block.content.doc} className="text-base" />
          </aside>
        );
      }
      case "VIDEO": {
        const video = block.videoId ? content.videos[block.videoId] : undefined;
        if (!video) return null;
        return (
          <div className="grid gap-2">
            <LessonVideoPlayer video={video} lessonId={lessonId} startAt={videoStartAt} watermark={watermark} trackProgress={trackProgress} />
            {block.content.caption && <p className="text-sm text-muted-foreground">{block.content.caption}</p>}
          </div>
        );
      }
      case "AUDIO":
        return (
          <figure className="grid gap-2 rounded-xl border bg-card p-4">
            {block.content.caption && <figcaption className="text-sm font-medium">{block.content.caption}</figcaption>}
            <audio controls preload="none" controlsList="nodownload" className="w-full" src={`/api/media/${block.content.mediaId}`}>
              {t("audioUnsupported")}
            </audio>
            {block.content.transcript && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">{t("transcript")}</summary>
                <p className="mt-2 whitespace-pre-line" lang="en">
                  {block.content.transcript}
                </p>
              </details>
            )}
          </figure>
        );
      case "IMAGE":
        return (
          <figure className="grid gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par URL signée */}
            <img
              src={`/api/media/${block.content.mediaId}`}
              alt={block.content.alt}
              loading="lazy"
              decoding="async"
              className="max-h-[480px] w-full rounded-xl border object-contain"
            />
            {block.content.caption && <figcaption className="text-center text-sm text-muted-foreground">{block.content.caption}</figcaption>}
          </figure>
        );
      case "VOCAB_LIST":
        return <VocabList content={block.content} />;
    }
  };

  return (
    <div className="grid gap-8">
      {content.blocks.map((b) => (
        <section key={b.id} data-block={b.kind}>
          {render(b)}
        </section>
      ))}
    </div>
  );
}
