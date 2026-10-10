"use client";

import { Captions, ListVideo, ScrollText } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatClock, parseSubtitles, type Cue } from "@/features/video/captions";
import { cn } from "@/lib/utils";
import { saveVideoPositionAction } from "../actions";
import type { LessonVideoData } from "../queries";

const MuxPlayer = dynamic(() => import("@mux/mux-player-react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />,
});

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

type MediaLike = { currentTime: number; duration: number; playbackRate: number; play: () => Promise<void> | void };

/**
 * Lecteur vidéo de leçon : sources signées (Mux) ou locales, chapitres, sous-titres
 * anglais/français, transcription synchronisée cliquable, vitesse de lecture,
 * reprise de la position, et filigrane discret à l'adresse de l'étudiant (dissuasion).
 */
export function LessonVideoPlayer({
  video,
  lessonId,
  startAt = 0,
  watermark,
  trackProgress,
}: {
  video: LessonVideoData;
  lessonId?: string;
  startAt?: number;
  watermark?: string;
  trackProgress: boolean;
}) {
  const t = useTranslations("learn.video");
  const media = useRef<MediaLike | null>(null);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [cues, setCues] = useState<Cue[]>([]);
  const [panel, setPanel] = useState<"chapters" | "transcript" | null>(video.chapters.length ? "chapters" : null);
  const lastSaved = useRef(0);
  const hasTranscript = video.captions.includes("en");

  useEffect(() => {
    if (!hasTranscript) return;
    let cancelled = false;
    fetch(`/api/video/${video.id}/captions/en`)
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => !cancelled && setCues(parseSubtitles(text)));
    return () => {
      cancelled = true;
    };
  }, [video.id, hasTranscript]);

  const onTime = useCallback(
    (el: MediaLike) => {
      setTime(el.currentTime);
      if (!trackProgress || !lessonId || !el.duration) return;
      const now = Date.now();
      if (now - lastSaved.current < 15_000) return;
      lastSaved.current = now;
      void saveVideoPositionAction(null, {
        lessonId,
        seconds: Math.floor(el.currentTime),
        percent: Math.min(100, Math.round((el.currentTime / el.duration) * 100)),
      });
    },
    [lessonId, trackProgress],
  );

  const seek = (seconds: number) => {
    if (!media.current) return;
    media.current.currentTime = seconds;
    void media.current.play();
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (media.current) media.current.playbackRate = s;
  };

  const activeCue = useMemo(() => cues.findIndex((c) => time >= c.start && time < c.end), [cues, time]);
  const activeChapter = useMemo(() => {
    let idx = -1;
    video.chapters.forEach((c, i) => {
      if (time >= c.start) idx = i;
    });
    return idx;
  }, [video.chapters, time]);

  if (video.source.kind === "unavailable") {
    return <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">{t("unavailable")}</div>;
  }

  return (
    <figure className="grid gap-3">
      <div className="relative overflow-hidden rounded-xl bg-black" onContextMenu={(e) => e.preventDefault()}>
        {video.source.kind === "file" ? (
          <video
            ref={(el) => {
              media.current = el;
            }}
            className="aspect-video w-full"
            src={video.source.src}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onLoadedMetadata={(e) => {
              if (startAt > 0 && startAt < e.currentTarget.duration - 5) e.currentTarget.currentTime = startAt;
            }}
            onTimeUpdate={(e) => onTime(e.currentTarget)}
          >
            {video.captions.map((lang) => (
              <track
                key={lang}
                kind="subtitles"
                srcLang={lang}
                label={lang === "en" ? "English" : "Français"}
                src={`/api/video/${video.id}/captions/${lang}`}
              />
            ))}
          </video>
        ) : (
          <MuxPlayer
            ref={(el: unknown) => {
              media.current = el as MediaLike | null;
            }}
            playbackId={video.source.playbackId}
            tokens={video.source.tokens}
            startTime={startAt}
            accentColor="#C8102E"
            metadata={{ video_title: video.title }}
            onTimeUpdate={(e: Event) => onTime(e.target as unknown as MediaLike)}
            className="aspect-video w-full"
          />
        )}
        {watermark && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-[12%] left-[8%] animate-[watermark_40s_linear_infinite] text-xs font-medium text-white/25 select-none"
          >
            {watermark}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">{t("speed")}</span>
          <select
            value={speed}
            onChange={(e) => changeSpeed(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        {video.chapters.length > 0 && (
          <button
            type="button"
            onClick={() => setPanel(panel === "chapters" ? null : "chapters")}
            aria-pressed={panel === "chapters"}
            className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1", panel === "chapters" && "bg-accent")}
          >
            <ListVideo className="size-4" aria-hidden /> {t("chapters")}
          </button>
        )}
        {hasTranscript && (
          <button
            type="button"
            onClick={() => setPanel(panel === "transcript" ? null : "transcript")}
            aria-pressed={panel === "transcript"}
            className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1", panel === "transcript" && "bg-accent")}
          >
            <ScrollText className="size-4" aria-hidden /> {t("transcript")}
          </button>
        )}
        {video.captions.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Captions className="size-4" aria-hidden /> {video.captions.map((c) => c.toUpperCase()).join(" · ")}
          </span>
        )}
      </div>

      {panel === "chapters" && (
        <ol className="grid gap-1 rounded-xl border bg-card p-2" aria-label={t("chapters")}>
          {video.chapters.map((c, i) => (
            <li key={`${c.start}-${c.title}`}>
              <button
                type="button"
                onClick={() => seek(c.start)}
                aria-current={i === activeChapter ? "true" : undefined}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent", i === activeChapter && "bg-accent font-medium")}
              >
                <span className="w-12 font-mono text-xs text-muted-foreground tabular-nums">{formatClock(c.start)}</span>
                {c.title}
              </button>
            </li>
          ))}
        </ol>
      )}

      {panel === "transcript" && (
        <div className="max-h-72 overflow-y-auto rounded-xl border bg-card p-3" aria-label={t("transcript")}>
          {cues.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : (
            <p className="leading-relaxed">
              {cues.map((c, i) => (
                <button
                  key={`${c.start}-${i}`}
                  type="button"
                  onClick={() => seek(c.start)}
                  className={cn("mr-1 rounded px-0.5 text-left transition-colors hover:bg-accent", i === activeCue && "bg-brand/30")}
                >
                  {c.text}
                </button>
              ))}
            </p>
          )}
        </div>
      )}
    </figure>
  );
}
