"use client";

import { ArrowDown, ArrowUp, Loader2, Music, Plus, Trash2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpload } from "@/features/content/components/use-upload";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { saveQuestionAction } from "../actions";
import { parseGapText, QUESTION_TYPES, questionInputSchema, type QuestionInput, type QuestionType } from "../questions";
import { selectClass } from "./exercise-form";

type Draft = {
  type: QuestionType;
  prompt: string;
  explanation: string;
  points: number;
  options: string[];
  correct: number;
  correctMulti: number[];
  correctBool: boolean;
  text: string;
  accepted: string[];
  items: string[];
  pairs: { left: string; right: string }[];
  audioFileId: string;
  audioName: string;
};

function toDraft(q?: QuestionInput, audioName?: string | null): Draft {
  const d: Draft = {
    type: q?.type ?? "MCQ",
    prompt: q?.prompt ?? "",
    explanation: q?.explanation ?? "",
    points: q?.points ?? 1,
    options: ["", ""],
    correct: 0,
    correctMulti: [],
    correctBool: true,
    text: "",
    accepted: [""],
    items: ["", ""],
    pairs: [
      { left: "", right: "" },
      { left: "", right: "" },
    ],
    audioFileId: "",
    audioName: audioName ?? "",
  };
  if (!q) return d;
  if (q.type === "MCQ" || q.type === "LISTENING_MCQ") Object.assign(d, { options: q.options, correct: q.correct });
  if (q.type === "LISTENING_MCQ") d.audioFileId = q.audioFileId;
  if (q.type === "MULTI_SELECT") Object.assign(d, { options: q.options, correctMulti: q.correct });
  if (q.type === "TRUE_FALSE") d.correctBool = q.correct;
  if (q.type === "GAP_FILL") d.text = q.text;
  if (q.type === "SHORT_ANSWER") d.accepted = q.accepted;
  if (q.type === "ORDERING") d.items = q.items;
  if (q.type === "MATCHING") d.pairs = q.pairs;
  return d;
}

function fromDraft(d: Draft): unknown {
  const common = { prompt: d.prompt, explanation: d.explanation, points: d.points };
  const options = d.options.map((o) => o.trim());
  switch (d.type) {
    case "MCQ":
      return { type: d.type, ...common, options, correct: d.correct };
    case "LISTENING_MCQ":
      return { type: d.type, ...common, options, correct: d.correct, audioFileId: d.audioFileId };
    case "MULTI_SELECT":
      return { type: d.type, ...common, options, correct: d.correctMulti };
    case "TRUE_FALSE":
      return { type: d.type, ...common, correct: d.correctBool };
    case "GAP_FILL":
      return { type: d.type, ...common, text: d.text };
    case "SHORT_ANSWER":
      return { type: d.type, ...common, accepted: d.accepted.map((a) => a.trim()).filter(Boolean) };
    case "ORDERING":
      return { type: d.type, ...common, items: d.items.map((i) => i.trim()) };
    case "MATCHING":
      return { type: d.type, ...common, pairs: d.pairs.map((p) => ({ left: p.left.trim(), right: p.right.trim() })) };
  }
}

/** Formulaire d'une question ; s'adapte au type choisi. La validation est la même que côté serveur. */
export function QuestionForm({
  exerciseId,
  questionId,
  initial,
  audioName,
  onDone,
}: {
  exerciseId: string;
  questionId?: string;
  initial?: QuestionInput;
  audioName?: string | null;
  onDone: () => void;
}) {
  const t = useTranslations("exercises.question");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => toDraft(initial, audioName));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const err = (path: string) => (errors[path] ? <p className="text-sm text-destructive">{tv(errors[path]!)}</p> : null);

  const save = async () => {
    const parsed = questionInputSchema.safeParse(fromDraft(d));
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[String(issue.path[0] ?? "form")] ??= issue.message;
      setErrors(map);
      return;
    }
    setErrors({});
    setSaving(true);
    const res = await saveQuestionAction(null, { exerciseId, questionId, question: parsed.data });
    setSaving(false);
    if (!res.ok) return toast.error(te(res.error));
    toast.success(t("saved"));
    router.refresh();
    onDone();
  };

  const choiceType = d.type === "MCQ" || d.type === "LISTENING_MCQ" || d.type === "MULTI_SELECT";

  return (
    <div className="grid gap-5 rounded-2xl border-2 border-brand/30 bg-card p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="grid gap-2">
          <Label htmlFor="q-type">{t("type")}</Label>
          <select id="q-type" className={selectClass} value={d.type} onChange={(e) => set({ type: e.target.value as QuestionType })}>
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t(`help.${d.type}`)}</p>
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor="q-points">{t("points")}</Label>
          <Input id="q-points" type="number" min={1} max={20} className="h-11" value={d.points} onChange={(e) => set({ points: Number(e.target.value) || 1 })} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="q-prompt">{t("prompt")}</Label>
        <Textarea id="q-prompt" rows={2} maxLength={1000} value={d.prompt} onChange={(e) => set({ prompt: e.target.value })} placeholder={t(`promptPlaceholder.${d.type}`)} aria-invalid={!!errors.prompt} />
        {err("prompt")}
      </div>

      {d.type === "LISTENING_MCQ" && <AudioPicker d={d} set={set} error={err("audioFileId")} />}

      {choiceType && (
        <Group label={t("options")} hint={d.type === "MULTI_SELECT" ? t("checkCorrectMulti") : t("checkCorrect")} error={err("options") ?? err("correct")}>
          {d.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={d.type === "MULTI_SELECT" ? "checkbox" : "radio"}
                name="q-correct"
                aria-label={t("markCorrect", { n: i + 1 })}
                className="size-5 accent-[var(--success)]"
                checked={d.type === "MULTI_SELECT" ? d.correctMulti.includes(i) : d.correct === i}
                onChange={() =>
                  d.type === "MULTI_SELECT"
                    ? set({ correctMulti: d.correctMulti.includes(i) ? d.correctMulti.filter((x) => x !== i) : [...d.correctMulti, i] })
                    : set({ correct: i })
                }
              />
              <Input value={o} maxLength={300} placeholder={t("optionN", { n: i + 1 })} onChange={(e) => set({ options: d.options.map((x, j) => (j === i ? e.target.value : x)) })} />
              <RemoveButton
                disabled={d.options.length <= 2}
                label={t("remove")}
                onClick={() =>
                  set({
                    options: d.options.filter((_, j) => j !== i),
                    correct: d.correct === i ? 0 : d.correct > i ? d.correct - 1 : d.correct,
                    correctMulti: d.correctMulti.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)),
                  })
                }
              />
            </div>
          ))}
          {d.options.length < 8 && <AddButton label={t("addOption")} onClick={() => set({ options: [...d.options, ""] })} />}
        </Group>
      )}

      {d.type === "TRUE_FALSE" && (
        <Group label={t("correctAnswer")}>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => set({ correctBool: v })}
                aria-pressed={d.correctBool === v}
                className={cn("rounded-lg border px-4 py-2 text-sm font-medium", d.correctBool === v ? "border-success bg-success/10" : "hover:bg-muted")}
              >
                {v ? t("true") : t("false")}
              </button>
            ))}
          </div>
        </Group>
      )}

      {d.type === "GAP_FILL" && (
        <Group label={t("gapText")} hint={t("gapHint")} error={err("text")}>
          <code className="-mt-1 mb-1 justify-self-start rounded bg-muted px-2 py-1 text-xs">{"I {am|'m} a student and my sister {is} a doctor."}</code>
          <Textarea rows={4} maxLength={2000} value={d.text} onChange={(e) => set({ text: e.target.value })} placeholder="I {am|'m} a student and my sister {is} a doctor." className="font-mono text-sm" />
          {d.text && <GapPreview text={d.text} label={t("preview")} />}
        </Group>
      )}

      {d.type === "SHORT_ANSWER" && (
        <Group label={t("acceptedAnswers")} hint={t("acceptedHint")} error={err("accepted")}>
          {d.accepted.map((a, i) => (
            <div key={i} className="flex gap-2">
              <Input value={a} maxLength={200} placeholder={t("answerN", { n: i + 1 })} onChange={(e) => set({ accepted: d.accepted.map((x, j) => (j === i ? e.target.value : x)) })} />
              <RemoveButton disabled={d.accepted.length <= 1} label={t("remove")} onClick={() => set({ accepted: d.accepted.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {d.accepted.length < 10 && <AddButton label={t("addAnswer")} onClick={() => set({ accepted: [...d.accepted, ""] })} />}
        </Group>
      )}

      {d.type === "ORDERING" && (
        <Group label={t("orderItems")} hint={t("orderHint")} error={err("items")}>
          {d.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-right text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
              <Input value={item} maxLength={200} onChange={(e) => set({ items: d.items.map((x, j) => (j === i ? e.target.value : x)) })} />
              <Button type="button" variant="ghost" size="icon" disabled={i === 0} aria-label={t("moveUp")} onClick={() => set({ items: swap(d.items, i, i - 1) })}>
                <ArrowUp className="size-4" aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon" disabled={i === d.items.length - 1} aria-label={t("moveDown")} onClick={() => set({ items: swap(d.items, i, i + 1) })}>
                <ArrowDown className="size-4" aria-hidden />
              </Button>
              <RemoveButton disabled={d.items.length <= 2} label={t("remove")} onClick={() => set({ items: d.items.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {d.items.length < 10 && <AddButton label={t("addItem")} onClick={() => set({ items: [...d.items, ""] })} />}
        </Group>
      )}

      {d.type === "MATCHING" && (
        <Group label={t("pairs")} hint={t("pairsHint")} error={err("pairs")}>
          {d.pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={p.left} maxLength={200} placeholder={t("left")} onChange={(e) => set({ pairs: d.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })} />
              <span className="text-muted-foreground" aria-hidden>
                ↔
              </span>
              <Input value={p.right} maxLength={200} placeholder={t("right")} onChange={(e) => set({ pairs: d.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })} />
              <RemoveButton disabled={d.pairs.length <= 2} label={t("remove")} onClick={() => set({ pairs: d.pairs.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {d.pairs.length < 10 && <AddButton label={t("addPair")} onClick={() => set({ pairs: [...d.pairs, { left: "", right: "" }] })} />}
        </Group>
      )}

      <div className="grid gap-2">
        <Label htmlFor="q-explanation">{t("explanation")}</Label>
        <Textarea id="q-explanation" rows={2} maxLength={1000} value={d.explanation} onChange={(e) => set({ explanation: e.target.value })} placeholder={t("explanationPlaceholder")} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

function swap<T>(list: T[], i: number, j: number): T[] {
  const a = [...list];
  [a[i], a[j]] = [a[j]!, a[i]!];
  return a;
}

function Group({ label, hint, error, children }: { label: string; hint?: string; error?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      {hint && <p className="-mt-1 mb-1 text-xs text-muted-foreground">{hint}</p>}
      {children}
      {error}
    </fieldset>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="justify-self-start">
      <Plus className="size-4" aria-hidden /> {label}
    </Button>
  );
}

function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="ghost" size="icon" onClick={onClick} disabled={disabled} aria-label={label}>
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}

function GapPreview({ text, label }: { text: string; label: string }) {
  const { segments, answers } = parseGapText(text);
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-sm leading-loose">
      <span className="mr-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
      {segments.map((s, i) => (
        <span key={i}>
          {s}
          {i < answers.length && <span className="mx-1 inline-block min-w-16 rounded border-b-2 border-brand bg-background px-2 text-center text-success">{answers[i]!.join(" / ")}</span>}
        </span>
      ))}
    </div>
  );
}

function AudioPicker({ d, set, error }: { d: Draft; set: (p: Partial<Draft>) => void; error: ReactNode }) {
  const t = useTranslations("exercises.question");
  const te = useTranslations("errors");
  const input = useRef<HTMLInputElement>(null);
  const { state, upload } = useUpload("LESSON_AUDIO");
  const pick = async (file: File) => {
    const res = await upload(file);
    if (res) set({ audioFileId: res.id, audioName: res.name });
  };
  return (
    <Group label={t("audio")} hint={t("audioHint")} error={error ?? (state.status === "error" ? <p className="text-sm text-destructive">{te(state.error)}</p> : null)}>
      {d.audioFileId ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <Music className="size-5 text-brand-ink" aria-hidden />
          <span className="text-sm font-medium">{d.audioName || t("audioFile")}</span>
          <audio controls preload="none" src={`/api/media/${d.audioFileId}`} className="h-9 max-w-full" />
          <Button type="button" variant="ghost" size="sm" onClick={() => set({ audioFileId: "", audioName: "" })}>
            <X className="size-4" aria-hidden /> {t("replace")}
          </Button>
        </div>
      ) : (
        <>
          <input ref={input} type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
          <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={state.status === "uploading"} className="justify-self-start">
            {state.status === "uploading" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {state.status === "uploading" ? `${state.progress} %` : t("uploadAudio")}
          </Button>
        </>
      )}
    </Group>
  );
}
