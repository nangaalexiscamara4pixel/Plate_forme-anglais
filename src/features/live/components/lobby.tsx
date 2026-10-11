"use client";

import { CalendarClock, Clock, Info, Loader2, Mic, MicOff, Users, Video, VideoOff } from "lucide-react";
import { motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MediaPrefs } from "./media";
import { avatarColor, formatClock, initials, useNow } from "./use-room";

/**
 * Hall d'accueil : test de la caméra et du micro (rien n'est envoyé avant d'entrer), infos de
 * la séance et compte à rebours. Les choix sont repris à l'entrée dans la salle.
 */
export function Lobby({
  me,
  title,
  levelCode,
  startsAt,
  endsAt,
  isHost,
  demo,
  joining,
  serverNow,
  onJoin,
}: {
  me: { userId: string; name: string };
  title: string;
  levelCode: string;
  startsAt: string;
  endsAt: string;
  isHost: boolean;
  demo: boolean;
  joining: boolean;
  serverNow: number;
  onJoin: (prefs: MediaPrefs) => void;
}) {
  const t = useTranslations("live.room");
  const format = useFormatter();
  const now = useNow(serverNow);
  const [prefs, setPrefs] = useState<MediaPrefs>({ mic: false, cam: false });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Aperçu local selon les choix (caméra et/ou micro).
  useEffect(() => {
    let cancelled = false;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (!prefs.cam && !prefs.mic) return;
    navigator.mediaDevices
      .getUserMedia({ video: prefs.cam ? { width: 1280, height: 720 } : false, audio: prefs.mic })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((tr) => tr.stop());
        streamRef.current = s;
        setStream(s);
        setError(null);
      })
      .catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : "";
        setError(name === "NotAllowedError" ? "deviceDenied" : name === "NotFoundError" ? "deviceMissing" : "deviceGeneric");
        setPrefs({ mic: false, cam: false });
      });
    return () => {
      cancelled = true;
    };
  }, [prefs]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((tr) => tr.stop()), []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // Vumètre du micro.
  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!track) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const loop = () => {
      analyser.getByteFrequencyData(data);
      setLevel(Math.min(1, data.reduce((a, b) => a + b, 0) / data.length / 60));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ctx.close().catch(() => {});
    };
  }, [stream]);

  const active = prefs.cam || prefs.mic ? stream : null;
  const micLevel = active?.getAudioTracks().length ? level : 0;
  const start = Date.parse(startsAt);
  const started = now >= start;
  const join = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop()); // la salle rouvre ses propres flux
    streamRef.current = null;
    onJoin(prefs);
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 py-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="relative aspect-video overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_50%_35%,oklch(0.32_0.09_264),oklch(0.18_0.05_264))] shadow-2xl ring-1 ring-white/10">
          {prefs.cam && active ? (
            <video ref={videoRef} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3">
              <span className={cn("flex size-24 items-center justify-center rounded-full font-display text-3xl text-white shadow-xl", avatarColor(me.userId))} aria-hidden>
                {initials(me.name)}
              </span>
              <p className="text-sm text-white/60">{t("cameraOffPreview")}</p>
            </div>
          )}
          {prefs.mic && (
            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur" aria-hidden>
              <Mic className="size-3.5" />
              <span className="flex h-3 items-end gap-0.5">
                {[0.15, 0.35, 0.55, 0.75, 0.9].map((th) => (
                  <span key={th} className={cn("w-1 rounded-full transition-all duration-75", micLevel > th ? "h-3 bg-emerald-400" : "h-1.5 bg-white/30")} />
                ))}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-5">
            <PreviewToggle on={prefs.mic} label={prefs.mic ? t("micOff") : t("micOn")} onClick={() => setPrefs((p) => ({ ...p, mic: !p.mic }))}>
              {prefs.mic ? <Mic className="size-5" aria-hidden /> : <MicOff className="size-5" aria-hidden />}
            </PreviewToggle>
            <PreviewToggle on={prefs.cam} label={prefs.cam ? t("camOff") : t("camOn")} onClick={() => setPrefs((p) => ({ ...p, cam: !p.cam }))}>
              {prefs.cam ? <Video className="size-5" aria-hidden /> : <VideoOff className="size-5" aria-hidden />}
            </PreviewToggle>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-500/15 px-4 py-2.5 text-sm text-red-200">
            {t(error)}
          </p>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="grid gap-6">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">
            <span className={cn("size-2 rounded-full", started ? "animate-pulse bg-red-500" : "bg-emerald-400")} aria-hidden />
            {started ? t("liveNow") : t("roomOpen")}
          </p>
          <h1 className="font-display text-3xl leading-tight text-balance text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 text-white/60">{t("lobbySubtitle", { level: levelCode })}</p>
        </div>
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center gap-3 text-white/80">
            <CalendarClock className="size-4 text-brand-soft" aria-hidden />
            <dt className="sr-only">{t("schedule")}</dt>
            <dd>
              {/* Début et fin formatés séparément : le format « plage » diffère entre Node et les navigateurs. */}
              {format.dateTime(new Date(startsAt), { weekday: "long", day: "numeric", month: "long" })} ·{" "}
              {format.dateTime(new Date(startsAt), { hour: "2-digit", minute: "2-digit" })} – {format.dateTime(new Date(endsAt), { hour: "2-digit", minute: "2-digit" })}
            </dd>
          </div>
          <div className="flex items-center gap-3 text-white/80">
            <Clock className="size-4 text-brand-soft" aria-hidden />
            <dt className="sr-only">{t("status")}</dt>
            <dd className="tabular-nums">{started ? t("startedSince", { time: formatClock(now - start) }) : t("startsIn", { time: formatClock(start - now) })}</dd>
          </div>
          <div className="flex items-center gap-3 text-white/80">
            <Users className="size-4 text-brand-soft" aria-hidden />
            <dt className="sr-only">{t("role")}</dt>
            <dd>{isHost ? t("joinAsHost") : t("joinAsStudent")}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={join}
          disabled={joining}
          className="group relative flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-brand text-base font-semibold text-white shadow-[0_10px_30px_-8px] shadow-brand/60 transition hover:bg-brand/90 disabled:opacity-70"
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
          {joining && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {t("enterRoom")}
        </button>
        <p className="text-xs leading-relaxed text-white/50">{t("lobbyPrivacy")}</p>
        {demo && (
          <p className="flex gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs leading-relaxed text-amber-100">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("demoNotice")}
          </p>
        )}
      </motion.div>
    </div>
  );
}

function PreviewToggle({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={cn("flex size-12 items-center justify-center rounded-full text-white shadow-lg backdrop-blur transition active:scale-95", on ? "bg-white/20 hover:bg-white/30" : "bg-red-500 hover:bg-red-400")}
    >
      {children}
    </button>
  );
}
