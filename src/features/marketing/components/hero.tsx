"use client";

import { ArrowRight, Pause, Play } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Héros : mosaïque de photos (fournies par le serveur) et encadré sombre dont le titre défile.
 * Le défilement s'arrête au survol, au focus, sur demande (bouton pause) et si l'utilisateur
 * préfère réduire les animations.
 */
export function Hero({ tiles }: { tiles: { main: ReactNode; topLeft: ReactNode; bottomLeft: ReactNode; topRight: ReactNode; bottomRight: ReactNode } }) {
  const t = useTranslations("site.hero");
  const slides = t.raw("slides") as { title: string; text: string }[];
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [paused, setPaused] = useState(false); // pause demandée explicitement
  const running = !paused && !hovered && !reduce;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [running, slides.length]);

  const slide = slides[index]!;

  return (
    <section aria-roledescription="carousel" aria-label={t("label")} className="mx-auto max-w-6xl px-4 pt-6 sm:pt-10">
      <div
        className="relative grid gap-3 md:h-[520px] md:grid-cols-[1fr_1.6fr_1fr] md:grid-rows-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <div className="hidden overflow-hidden rounded-2xl md:block [&>*]:h-full">{tiles.topLeft}</div>
        <div className="h-72 overflow-hidden rounded-2xl sm:h-96 md:row-span-2 md:h-auto [&>*]:h-full">{tiles.main}</div>
        <div className="hidden overflow-hidden rounded-2xl md:block [&>*]:h-full">{tiles.topRight}</div>
        <div className="hidden overflow-hidden rounded-2xl md:block [&>*]:h-full">{tiles.bottomLeft}</div>
        <div className="hidden overflow-hidden rounded-2xl md:block [&>*]:h-full">{tiles.bottomRight}</div>

        {/* Encadré de titre, à cheval sur la mosaïque comme sur la maquette */}
        <div className="relative -mt-24 mx-3 rounded-2xl bg-night/90 p-6 text-white shadow-2xl backdrop-blur-sm sm:p-8 md:absolute md:top-1/2 md:left-[12%] md:mx-0 md:mt-0 md:w-[min(560px,62%)] md:-translate-y-1/2">
          <p className="mb-3 text-xs font-semibold tracking-[0.3em] text-gold uppercase">{t("eyebrow")}</p>
          <div aria-live={running ? "off" : "polite"} className="min-h-[7.5rem] sm:min-h-[8.5rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                aria-roledescription="slide"
                aria-label={t("slideOf", { index: index + 1, total: slides.length })}
              >
                <h1 className="text-3xl leading-tight font-medium text-balance sm:text-4xl">{slide.title}</h1>
                <p className="mt-3 text-white/75">{slide.text}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-night hover:bg-gold/90">
              <Link href="/sign-up">
                {t("cta")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link href="/#formations">{t("secondary")}</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={t("goTo", { index: i + 1 })}
            aria-current={i === index ? "true" : undefined}
            className="flex size-6 items-center justify-center"
          >
            <span className={cn("size-2 rounded-full transition-all", i === index ? "w-6 bg-gold" : "bg-muted-foreground/40 hover:bg-muted-foreground/70")} />
          </button>
        ))}
        {!reduce && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? t("play") : t("pause")}
            className="ml-1 flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
          </button>
        )}
      </div>
    </section>
  );
}
