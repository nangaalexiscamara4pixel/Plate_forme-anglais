"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { FileIcon } from "@/components/file-drop";
import { cn } from "@/lib/utils";
import type { PublicQuestion } from "../questions";

export type Response = Record<string, unknown> | undefined;

/** Champ de réponse d'une question, selon son type (contrôlé par le lecteur d'exercice). */
function AnswerInput({
  q,
  value,
  onChange,
  disabled,
  tone = "neutral",
}: {
  q: PublicQuestion;
  value: Response;
  onChange: (v: Record<string, unknown>) => void;
  disabled?: boolean;
  /** Correction : la réponse choisie apparaît en vert (juste) ou en rouge (fausse). */
  tone?: "neutral" | "correct" | "wrong";
}) {
  const t = useTranslations("exercises.player");
  const v = value ?? {};
  const picked = { neutral: "border-primary bg-primary/5", correct: "border-success bg-success/10", wrong: "border-destructive bg-destructive/10" }[tone];
  const mark = { neutral: "border-primary bg-primary text-primary-foreground", correct: "border-success bg-success text-white", wrong: "border-destructive bg-destructive text-white" }[tone];
  const line = { neutral: "border-primary bg-primary/5 focus:ring-primary/30", correct: "border-success bg-success/10", wrong: "border-destructive bg-destructive/10" }[tone];

  switch (q.type) {
    case "MCQ":
    case "LISTENING_MCQ":
    case "MULTI_SELECT": {
      const multi = q.type === "MULTI_SELECT";
      const chosen = multi ? ((v.choices as number[]) ?? []) : [v.choice as number];
      return (
        <div className="grid gap-2" role={multi ? "group" : "radiogroup"}>
          {q.type === "LISTENING_MCQ" && q.audioFileId && <audio controls preload="metadata" src={`/api/media/${q.audioFileId}`} className="mb-2 w-full" />}
          {multi && <p className="text-xs text-muted-foreground">{t("severalAnswers")}</p>}
          {q.options!.map((option, i) => {
            const on = chosen.includes(i);
            return (
              <button
                key={i}
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={on}
                disabled={disabled}
                onClick={() => onChange(multi ? { choices: on ? chosen.filter((c) => c !== i) : [...chosen, i] } : { choice: i })}
                className={cn(
                  "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition",
                  on ? picked : "border-border hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                <span className={cn("flex size-6 shrink-0 items-center justify-center border-2 text-xs font-bold", multi ? "rounded-md" : "rounded-full", on ? mark : "border-muted-foreground/40")}>
                  {on ? <Check className="size-3.5" aria-hidden /> : String.fromCharCode(65 + i)}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      );
    }
    case "TRUE_FALSE":
      return (
        <div className="grid grid-cols-2 gap-3" role="radiogroup">
          {[true, false].map((b) => (
            <button
              key={String(b)}
              type="button"
              role="radio"
              aria-checked={v.value === b}
              disabled={disabled}
              onClick={() => onChange({ value: b })}
              className={cn("rounded-xl border-2 px-4 py-4 text-lg font-semibold transition", v.value === b ? picked : "border-border hover:bg-muted/50")}
            >
              {b ? t("true") : t("false")}
            </button>
          ))}
        </div>
      );
    case "GAP_FILL": {
      const blanks = (v.blanks as string[]) ?? [];
      const segments = q.segments!;
      return (
        <p className="text-lg leading-[2.6]">
          {segments.map((s, i) => (
            <span key={i}>
              {s}
              {i < segments.length - 1 && (
                <input
                  aria-label={t("blankN", { n: i + 1 })}
                  disabled={disabled}
                  value={blanks[i] ?? ""}
                  maxLength={200}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onChange={(e) => {
                    const next = [...blanks];
                    next[i] = e.target.value;
                    onChange({ blanks: Array.from({ length: segments.length - 1 }, (_, j) => next[j] ?? "") });
                  }}
                  className={cn("mx-1 inline-block w-32 rounded-md border-b-2 px-2 py-0.5 text-center text-base outline-none focus:ring-2", line)}
                />
              )}
            </span>
          ))}
        </p>
      );
    }
    case "SHORT_ANSWER":
      return (
        <input
          aria-label={t("yourAnswer")}
          disabled={disabled}
          value={(v.text as string) ?? ""}
          maxLength={500}
          autoComplete="off"
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={t("typeAnswer")}
          className={cn("h-12 w-full rounded-xl border-2 bg-transparent px-4 text-lg outline-none focus:border-primary", tone === "neutral" ? "border-border" : line)}
        />
      );
    case "ORDERING": {
      const order = (v.order as string[]) ?? q.items!;
      const move = (i: number, j: number) => {
        const next = [...order];
        [next[i], next[j]] = [next[j]!, next[i]!];
        onChange({ order: next });
      };
      return (
        <ol className="grid gap-2">
          {order.map((item, i) => (
            <li key={item} className="flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2">
              <span className="w-6 text-right font-semibold text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="flex-1">{item}</span>
              <button type="button" disabled={disabled || i === 0} onClick={() => move(i, i - 1)} aria-label={t("moveUp", { item })} className="rounded-lg p-2 hover:bg-muted disabled:opacity-30">
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button type="button" disabled={disabled || i === order.length - 1} onClick={() => move(i, i + 1)} aria-label={t("moveDown", { item })} className="rounded-lg p-2 hover:bg-muted disabled:opacity-30">
                <ArrowDown className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      );
    }
    case "MATCHING": {
      const matches = (v.matches as string[]) ?? [];
      return (
        <div className="grid gap-2">
          {q.left!.map((left, i) => (
            <div key={left} className="grid items-center gap-2 rounded-xl border-2 border-border p-3 sm:grid-cols-[1fr_auto_1fr]">
              <span className="font-medium">{left}</span>
              <span className="hidden text-muted-foreground sm:block" aria-hidden>
                →
              </span>
              <select
                aria-label={t("matchFor", { item: left })}
                disabled={disabled}
                value={matches[i] ?? ""}
                onChange={(e) => {
                  const next = Array.from({ length: q.left!.length }, (_, j) => matches[j] ?? "");
                  next[i] = e.target.value;
                  onChange({ matches: next });
                }}
                className="h-11 rounded-lg border border-input bg-transparent px-3"
              >
                <option value="">{t("choose")}</option>
                {q.right!.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }
  }
}

/** Image ou document joint à l'énoncé, puis le champ de réponse. */
export function QuestionInput(props: Parameters<typeof AnswerInput>[0]) {
  const t = useTranslations("files");
  const file = props.q.attachment;
  return (
    <>
      {file &&
        (file.mime.startsWith("image/") ? (
          <a href={`/api/media/${file.id}`} target="_blank" rel="noopener noreferrer" className="mb-4 block">
            {/* eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par URL signée */}
            <img src={`/api/media/${file.id}`} alt={file.name} loading="lazy" className="max-h-80 w-full rounded-xl border bg-muted/30 object-contain" />
          </a>
        ) : (
          <a
            href={`/api/media/${file.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 flex items-center gap-3 rounded-xl border bg-muted/30 p-3 text-sm hover:bg-muted/60"
          >
            <FileIcon mime={file.mime} className="size-6" />
            <span className="min-w-0 flex-1 truncate font-medium">{file.name || t("file")}</span>
            <span className="text-brand-ink">{t("open")}</span>
          </a>
        ))}
      <AnswerInput {...props} />
    </>
  );
}

/** Une réponse a-t-elle été donnée (pour le compteur de progression) ? */
export function isAnswered(q: PublicQuestion, v: Response): boolean {
  if (!v) return q.type === "ORDERING";
  if ("choice" in v) return typeof v.choice === "number";
  if ("choices" in v) return (v.choices as number[]).length > 0;
  if ("value" in v) return typeof v.value === "boolean";
  if ("blanks" in v) return (v.blanks as string[]).some((b) => b.trim());
  if ("text" in v) return String(v.text).trim() !== "";
  if ("matches" in v) return (v.matches as string[]).some(Boolean);
  return "order" in v;
}
