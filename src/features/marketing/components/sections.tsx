import { CalendarCheck, CheckCircle2, Clock, Headphones, MonitorPlay, Quote, ShieldCheck, Video } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LEVEL_CODES, LEVEL_THEME } from "@/components/brand/levels";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LEVEL_FACTS, visibleTestimonials, type SiteImageKey } from "../site-config";
import { SitePhoto } from "./site-photo";

export function SectionHeading({ eyebrow, title, subtitle, children, center = true }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode; center?: boolean }) {
  return (
    <div className={cn("mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", center && !children && "sm:justify-center sm:text-center")}>
      <div className={cn("max-w-2xl", center && !children && "mx-auto")}>
        {eyebrow && <p className="mb-2 text-xs font-semibold tracking-[0.3em] text-brand-ink uppercase">{eyebrow}</p>}
        <h2 className="text-3xl font-medium text-balance sm:text-4xl">{title}</h2>
        {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Carte au style de la maquette : image (pastille d'icône facultative), titre, sous-titre, jauge et pied. */
export function PhotoCard({
  image,
  imageAlt,
  badge,
  title,
  subtitle,
  meter,
  footer,
  href,
  aspect = "photo",
}: {
  image: SiteImageKey;
  imageAlt: string;
  badge?: ReactNode;
  /** Proportions de l'image : 4/3 pour une photo recadrée, 16/9 pour une affiche montrée en entier. */
  aspect?: "photo" | "poster";
  title: string;
  subtitle: string;
  meter?: { value: number; label: string; className: string };
  footer?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="relative">
        <SitePhoto
          name={image}
          alt={imageAlt}
          fit={aspect === "poster" ? "contain" : "cover"}
          className={cn("w-full rounded-xl", aspect === "poster" ? "aspect-video" : "aspect-[4/3]")}
          sizes={aspect === "poster" ? "(min-width: 640px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
        />
        {badge && <span className="absolute top-3 left-3 flex size-9 items-center justify-center rounded-lg bg-white/95 shadow-sm">{badge}</span>}
      </div>
      <div className="grid gap-1 px-1 pt-4">
        <h3 className="font-display text-xl">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {meter && (
        <div className="mt-4 grid gap-1.5 px-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter.value} aria-label={meter.label}>
            <div className={cn("h-full rounded-full", meter.className)} style={{ width: `${meter.value}%` }} />
          </div>
        </div>
      )}
      {footer && <div className="mt-3 flex items-center justify-between px-1 text-xs text-muted-foreground">{footer}</div>}
    </>
  );
  const cls = "group block rounded-2xl border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <article className={cls}>{body}</article>
  );
}

/** « Nos formations » — les quatre niveaux du CECRL, illustrés par leurs affiches (deux par ligne pour qu'elles restent lisibles). */
export async function LevelsSection() {
  const t = await getTranslations("site.levels");
  const tp = await getTranslations("site.photos");
  const tl = await getTranslations("levels");
  const images: Record<string, SiteImageKey> = { A1: "levelA1", A2: "levelA2", B1: "levelB1", B2: "levelB2" };
  return (
    <section id="formations" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6 sm:grid-cols-2">
        {LEVEL_CODES.map((code) => {
          const theme = LEVEL_THEME[code];
          const facts = LEVEL_FACTS[code];
          return (
            <PhotoCard
              key={code}
              href="/sign-up"
              image={images[code]!}
              imageAlt={tp(images[code]!)}
              aspect="poster"
              title={`${code} · ${tl(`${code}.name`)}`}
              subtitle={tl(`${code}.tagline`)}
              meter={{ value: facts.difficulty * 25, label: t("difficulty", { n: facts.difficulty }), className: theme.bg }}
              footer={
                <>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden /> {t("duration", { months: facts.months })}
                  </span>
                  <span className="flex gap-1" aria-label={t("difficulty", { n: facts.difficulty })}>
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={cn("size-1.5 rounded-full", i <= facts.difficulty ? theme.bg : "bg-muted")} />
                    ))}
                  </span>
                </>
              }
            />
          );
        })}
      </div>
    </section>
  );
}

/** Déroulé des cours en direct sur Google Meet. */
export async function LiveSection() {
  const t = await getTranslations("site.live");
  const steps = t.raw("steps") as { title: string; text: string }[];
  const icons = [CalendarCheck, Clock, Video, MonitorPlay];
  return (
    <section id="cours-en-direct" className="scroll-mt-24 bg-night text-night-foreground">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.3em] text-brand-soft uppercase">{t("eyebrow")}</p>
          <h2 className="text-3xl font-medium text-balance sm:text-4xl">{t("title")}</h2>
          <p className="mt-3 text-white/70">{t("subtitle")}</p>
          <ol className="mt-8 grid gap-5">
            {steps.map((s, i) => {
              const Icon = icons[i] ?? CheckCircle2;
              return (
                <li key={s.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-soft">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">
                      <span className="mr-2 text-brand-soft">{i + 1}.</span>
                      {s.title}
                    </p>
                    <p className="text-sm text-white/65">{s.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="relative">
          <SitePhoto name="liveClass" alt={t("imageAlt")} className="aspect-[4/3] rounded-2xl" sizes="(min-width: 1024px) 50vw, 100vw" />
          <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-night shadow-xl">
            <ShieldCheck className="size-5 text-success" aria-hidden />
            {t("badge")}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Témoignages — uniquement de vrais avis en production (voir site-config.ts). */
export async function TestimonialsSection() {
  const items = visibleTestimonials();
  if (items.length === 0) return null;
  const t = await getTranslations("site.testimonials");
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  return (
    <section id="temoignages" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((item) => {
          const theme = LEVEL_THEME[item.level];
          return (
            <figure key={item.name} className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm">
              <Quote className="size-8 text-brand" aria-hidden />
              <blockquote className="mt-4 flex-1 leading-relaxed">{item.quote[locale]}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t pt-4">
                <span className={cn("flex size-10 items-center justify-center rounded-full font-display text-white", theme.bg)} aria-hidden>
                  {item.name.replace(/^Exemple — /, "").charAt(0)}
                </span>
                <span>
                  <span className="block font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {regions.of(item.country)} · {item.level}
                  </span>
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

/** Questions fréquentes : éléments <details> natifs, accessibles au clavier sans JavaScript. */
export async function FaqSection() {
  const t = await getTranslations("site.faq");
  const items = t.raw("items") as { q: string; a: string }[];
  return (
    <section id="faq" className="scroll-mt-24 border-t bg-card/60">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        <div className="divide-y rounded-2xl border bg-card">
          {items.map((item) => (
            <details key={item.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {item.q}
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-sm transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Bandeau d'appel final. */
export async function CtaSection() {
  const t = await getTranslations("site.cta");
  const tc = await getTranslations("common");
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-night to-[oklch(0.3_0.08_263)] px-6 py-14 text-center text-white sm:px-12">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" aria-hidden />
        <Headphones className="relative mx-auto mb-5 size-10 text-brand-soft" aria-hidden />
        <h2 className="relative text-3xl font-medium text-balance sm:text-4xl">{t("title")}</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/75">{t("text")}</p>
        <Button asChild size="lg" className="relative mt-8 bg-brand text-white hover:bg-brand/90">
          <Link href="/sign-up">{tc("requestAccess")}</Link>
        </Button>
      </div>
    </section>
  );
}
