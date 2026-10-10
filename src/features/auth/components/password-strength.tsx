"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { passwordScore } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const COLORS = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success", "bg-success"];

/** Indicateur de robustesse (zxcvbn, chargé à la demande). */
export function PasswordStrength({ password, userInputs = [] }: { password: string; userInputs?: string[] }) {
  const t = useTranslations("auth.password");
  const [result, setResult] = useState<{ password: string; score: number } | null>(null);
  const inputsKey = userInputs.join("|");
  // Le score n'est affiché que s'il correspond au mot de passe actuellement saisi.
  const score = password && result?.password === password ? result.score : null;

  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    const id = setTimeout(() => {
      passwordScore(password, inputsKey.split("|")).then((s) => !cancelled && setResult({ password, score: s }));
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [password, inputsKey]);

  const labels = t.raw("levels") as string[];
  return (
    <div className="grid gap-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-muted transition-colors",
              score !== null && score > i && COLORS[score],
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {score === null ? t("hint") : `${t("strength")} : ${labels[score]}`}
      </p>
    </div>
  );
}
