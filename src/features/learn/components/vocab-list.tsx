"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BlockContent } from "@/features/content/blocks";

/** Encadré de vocabulaire, avec masquage des traductions pour s'auto-tester. */
export function VocabList({ content }: { content: BlockContent<"VOCAB_LIST"> }) {
  const t = useTranslations("learn.blocks");
  const [hidden, setHidden] = useState(false);
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label={content.title || t("vocabulary")}>
      <header className="flex items-center justify-between gap-3 border-b bg-accent/50 px-4 py-3">
        <h3 className="font-display text-lg">{content.title || t("vocabulary")}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setHidden((h) => !h)} aria-pressed={hidden}>
          {hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
          {hidden ? t("showTranslations") : t("hideTranslations")}
        </Button>
      </header>
      <dl className="divide-y">
        {content.items.map((item, i) => (
          <div key={`${item.term}-${i}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_1fr]">
            <dt>
              <span className="font-medium" lang="en">
                {item.term}
              </span>
              {item.partOfSpeech && <span className="ml-2 text-xs text-muted-foreground italic">{item.partOfSpeech}</span>}
              {item.example && (
                <span className="block text-sm text-muted-foreground italic" lang="en">
                  {item.example}
                </span>
              )}
            </dt>
            <dd className={hidden ? "select-none blur-sm" : undefined} aria-hidden={hidden || undefined}>
              {item.translation}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
