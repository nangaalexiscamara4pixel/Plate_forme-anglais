import { Check, Hourglass } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { requireGate } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("gate.pending");
  return { title: t("title"), robots: { index: false } };
}

export default async function PendingPage() {
  const viewer = await requireGate("pending");
  const t = await getTranslations("gate.pending");
  const steps = t.raw("steps") as string[];
  const currentStep = 2; // compte créé + email confirmé : on attend l'examen

  return (
    <div className="w-full max-w-xl text-center">
      <span className="mx-auto mb-8 flex size-20 items-center justify-center rounded-full border border-gold/40 bg-card shadow-sm">
        <Hourglass className="size-9 text-gold-ink motion-safe:animate-[spin_6s_ease-in-out_infinite]" aria-hidden />
      </span>
      <p className="mb-3 text-xs font-semibold tracking-[0.3em] text-gold-ink uppercase">{t("eyebrow")}</p>
      <h1 className="mb-5 text-3xl font-medium text-balance sm:text-4xl">{t("title")}</h1>
      <p className="mx-auto max-w-lg leading-relaxed text-muted-foreground">{t("body", { name: viewer.name })}</p>

      <ol className="mx-auto mt-10 grid max-w-md gap-3 text-left" aria-label={t("title")}>
        {steps.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm",
                active && "border-gold/50 ring-2 ring-gold/15",
                !done && !active && "opacity-60",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                  done && "border-success bg-success text-white",
                  active && "border-gold text-gold-ink",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      <p className="mt-8 text-sm text-muted-foreground">{t("delay")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("meanwhile")}</p>
    </div>
  );
}
