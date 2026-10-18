import { BookMarked, Globe2, Info, Lightbulb, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FileIcon } from "@/components/file-drop";
import { OpenFileButton } from "@/components/file-viewer";
import { fileKind } from "@/lib/files";
import { RichText } from "@/components/rich-text";
import type { RenderableBlock } from "@/features/content/blocks";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
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
            <OpenFileButton file={{ id: block.content.mediaId, name: block.content.caption || block.content.alt, mime: "image/*" }} className="block w-full cursor-zoom-in">
              {/* eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par URL signée */}
              <img
                src={`/api/media/${block.content.mediaId}`}
                alt={block.content.alt}
                loading="lazy"
                decoding="async"
                className="max-h-[480px] w-full rounded-xl border object-contain"
              />
            </OpenFileButton>
            {block.content.caption && <figcaption className="text-center text-sm text-muted-foreground">{block.content.caption}</figcaption>}
          </figure>
        );
      case "DOCUMENT":
        return <DocumentCard mediaId={block.content.mediaId} title={block.content.title} description={block.content.description} />;
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

/** Document à télécharger (PowerPoint, Word, PDF, Excel) : icône du type, nom, taille, ouverture. */
async function DocumentCard({ mediaId, title, description }: { mediaId: string; title: string; description?: string }) {
  const t = await getTranslations("files");
  const media = await db.mediaFile.findUnique({ where: { id: mediaId }, select: { mime: true, sizeBytes: true, originalName: true } });
  if (!media) return null;
  const size = media.sizeBytes >= 1024 * 1024 ? `${(media.sizeBytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(media.sizeBytes / 1024))} Ko`;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
      <span className="flex size-12 items-center justify-center rounded-lg bg-muted">
        <FileIcon mime={media.mime} className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <p className="text-xs text-muted-foreground uppercase">
          {t(`kinds.${fileKind(media.mime)}`)} · {size}
        </p>
      </div>
      <div className="flex gap-2">
        <OpenFileButton file={{ id: mediaId, name: media.originalName ?? title, mime: media.mime }} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted" />
        <a href={`/api/media/${mediaId}?download=1`} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          {t("download")}
        </a>
      </div>
    </div>
  );
}
