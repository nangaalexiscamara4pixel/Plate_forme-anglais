"use client";

import { GraduationCap, Hand, MessageSquare, Mic, MicOff, PhoneOff, Smile, Users, Video } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TILES = [
  { src: "/images/site/hero-student-london.jpg", name: "Mr. Carter", teacher: true, speaking: true, pos: "object-[50%_45%]" },
  { src: "/images/site/skill-listening-headphones.jpg", name: "Awa", pos: "object-[50%_25%]" },
  { src: "/images/site/skill-speaking-stage.jpg", name: "Fatou", hand: true, pos: "object-[50%_18%]" },
  { src: "/images/site/skill-reading-books.jpg", name: "Kofi", pos: "object-[50%_35%]" },
];
const FLOATERS = ["👏", "❤️", "👍", "🎉", "😂"];

/**
 * Aperçu animé de la salle virtuelle GlobeSpeak pour la page d'accueil : mosaïque vidéo, chat qui
 * se remplit, main levée et réactions qui s'envolent. Purement décoratif (une description textuelle
 * est fournie aux lecteurs d'écran) ; l'animation s'arrête si l'on préfère réduire les mouvements.
 */
export function RoomShowcase() {
  const t = useTranslations("site.live.showcase");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduce = useReducedMotion();
  const messages = t.raw("messages") as { name: string; text: string }[];
  const [shown, setShown] = useState(reduce ? messages.length : 1);
  const [floaters, setFloaters] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [second, setSecond] = useState(754);

  useEffect(() => {
    if (!inView || reduce) return;
    let n = 0;
    const chat = setInterval(() => setShown((s) => (s >= messages.length ? 1 : s + 1)), 2600);
    const react = setInterval(() => {
      const id = ++n;
      setFloaters((f) => [...f.slice(-6), { id, emoji: FLOATERS[id % FLOATERS.length]!, x: 12 + ((id * 37) % 70) }]);
      setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 3000);
    }, 1400);
    const clock = setInterval(() => setSecond((s) => s + 1), 1000);
    return () => {
      clearInterval(chat);
      clearInterval(react);
      clearInterval(clock);
    };
  }, [inView, reduce, messages.length]);

  const mm = String(Math.floor(second / 60)).padStart(2, "0");
  const ss = String(second % 60).padStart(2, "0");

  return (
    <figure ref={ref} className="relative">
      <figcaption className="sr-only">{t("description")}</figcaption>
      <div className="overflow-hidden rounded-2xl bg-[oklch(0.16_0.045_264)] p-3 pb-7 shadow-2xl ring-1 ring-white/10" aria-hidden>
        {/* Barre supérieure */}
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">GlobeSpeak</span>
          <span className="truncate text-xs font-medium text-white">{t("title")}</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white tabular-nums">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            {t("live")} · {mm}:{ss}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
            <Users className="size-3" />8
          </span>
        </div>
        <div className="flex gap-3">
          {/* Mosaïque */}
          <div className="relative grid flex-1 grid-cols-2 gap-2">
            {TILES.map((tile) => (
              <div
                key={tile.name}
                className={cn(
                  "relative aspect-video overflow-hidden rounded-xl ring-1 ring-white/10",
                  tile.speaking && "ring-2 ring-[oklch(0.72_0.15_155)] shadow-[0_0_0_4px_oklch(0.72_0.15_155/0.2)]",
                  tile.hand && "ring-2 ring-amber-400",
                )}
              >
                <Image src={tile.src} alt="" fill sizes="(min-width: 1024px) 15vw, 40vw" className={cn("object-cover", tile.pos)} />
                {tile.hand && (
                  <motion.span
                    className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-amber-400 text-night"
                    animate={reduce ? undefined : { rotate: [0, -14, 12, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6 }}
                  >
                    <Hand className="size-3.5" />
                  </motion.span>
                )}
                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  {tile.speaking ? <Mic className="size-2.5 text-emerald-300" /> : <MicOff className="size-2.5 text-red-300" />}
                  {tile.teacher && <GraduationCap className="size-2.5 text-amber-300" />}
                  <span className="whitespace-nowrap">{tile.name}</span>
                </span>
              </div>
            ))}
            {/* Réactions */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <AnimatePresence>
                {floaters.map((f) => (
                  <motion.span
                    key={f.id}
                    initial={{ y: 0, opacity: 0, scale: 0.6 }}
                    animate={{ y: -150, opacity: [0, 1, 1, 0], scale: [0.6, 1.2, 1, 1] }}
                    transition={{ duration: 2.8, ease: "easeOut" }}
                    className="absolute bottom-2 text-2xl drop-shadow"
                    style={{ left: `${f.x}%` }}
                  >
                    {f.emoji}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>
          {/* Chat */}
          <div className="hidden w-[38%] flex-col rounded-xl bg-white/5 p-2 ring-1 ring-white/10 sm:flex">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
              <MessageSquare className="size-3" />
              {t("chat")}
            </p>
            <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden">
              <AnimatePresence initial={false}>
                {messages.slice(0, shown).map((m) => (
                  <motion.div key={m.text} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-white/7 px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-brand-soft">{m.name}</p>
                    <p className="text-[11px] leading-snug text-white/85">{m.text}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
        {/* Barre de contrôle */}
        <div className="mt-3 flex justify-center gap-1.5">
          {[Mic, Video, Hand, Smile, MessageSquare].map((Icon, i) => (
            <span key={i} className={cn("flex size-8 items-center justify-center rounded-lg bg-white/10 text-white", i === 2 && "bg-amber-400 text-night")}>
              <Icon className="size-4" />
            </span>
          ))}
          <span className="flex h-8 items-center rounded-lg bg-red-600 px-2.5 text-white">
            <PhoneOff className="size-4" />
          </span>
        </div>
      </div>
    </figure>
  );
}
