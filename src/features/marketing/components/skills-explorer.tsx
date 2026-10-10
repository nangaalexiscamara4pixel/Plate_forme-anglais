"use client";

import { BookOpen, Ear, Mic, PenLine, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";

const ICONS = { READING: BookOpen, LISTENING: Ear, SPEAKING: Mic, WRITING: PenLine } as const;
export type SkillKey = keyof typeof ICONS;

/**
 * « Les quatre compétences », avec un champ de recherche qui filtre les cartes
 * (nom, description, exemples d'activités). Les photos sont rendues côté serveur.
 */
export function SkillsExplorer({ photos }: { photos: Record<SkillKey, ReactNode> }) {
  const t = useTranslations("site.skills");
  const [query, setQuery] = useState("");
  const items = useMemo(
    () =>
      (Object.keys(ICONS) as SkillKey[]).map((key) => ({
        key,
        name: t(`items.${key}.name`),
        text: t(`items.${key}.text`),
        activities: t(`items.${key}.activities`),
      })),
    [t],
  );
  const q = query.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const shown = q
    ? items.filter((i) => `${i.name} ${i.text} ${i.activities}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q))
    : items;

  return (
    <section id="competences" className="scroll-mt-24 bg-muted/50">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold tracking-[0.3em] text-brand-ink uppercase">{t("eyebrow")}</p>
            <h2 className="text-3xl font-medium text-balance sm:text-4xl">{t("title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="relative w-full sm:w-64" role="search">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="bg-card pl-9" />
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {t("results", { count: shown.length })}
        </p>
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">{t("noResults")}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((item) => {
              const Icon = ICONS[item.key];
              return (
                <article key={item.key} className="rounded-2xl border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="relative [&>div]:aspect-[4/3] [&>div]:w-full [&>div]:rounded-xl">
                    {photos[item.key]}
                    <span className="absolute top-3 left-3 flex size-9 items-center justify-center rounded-lg bg-white/95 shadow-sm">
                      <Icon className="size-4 text-brand-ink" aria-hidden />
                    </span>
                  </div>
                  <div className="grid gap-1 px-1 pt-4 pb-2">
                    <h3 className="font-display text-xl">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{item.activities}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
