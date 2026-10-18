"use client";

import { ArrowDown, ArrowUp, CheckCircle2, ListPlus, Music, Paperclip, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { deleteQuestionAction, moveQuestionAction } from "../actions";
import type { UploadedFile } from "@/features/content/components/use-upload";
import type { QuestionInput, QuestionType } from "../questions";
import { QuestionForm } from "./question-form";

export type EditorQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  input: QuestionInput;
  answer: string[];
  audioName: string | null;
  attachment: UploadedFile | null;
};

/** Liste des questions d'un exercice : ajout, modification, ordre, suppression. */
export function QuestionsEditor({ exerciseId, questions }: { exerciseId: string; questions: EditorQuestion[] }) {
  const t = useTranslations("exercises.question");
  const te = useTranslations("errors");
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(questions.length === 0 ? "new" : null);
  const total = questions.reduce((s, q) => s + q.points, 0);

  const move = async (questionId: string, direction: "up" | "down") => {
    const res = await moveQuestionAction(null, { exerciseId, questionId, direction });
    if (res.ok) router.refresh();
    else toast.error(te(res.error));
  };
  const remove = async (questionId: string) => {
    if (!window.confirm(t("confirmDelete"))) return;
    const res = await deleteQuestionAction(null, { exerciseId, questionId });
    if (res.ok) {
      toast.success(t("deleted"));
      router.refresh();
    } else toast.error(te(res.error));
  };

  return (
    <section className="grid content-start gap-4" aria-label={t("listLabel")}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">{t("listTitle", { count: questions.length })}</h2>
          <p className="text-sm text-muted-foreground">{t("totalPoints", { points: total })}</p>
        </div>
        {editing !== "new" && (
          <Button onClick={() => setEditing("new")}>
            <ListPlus className="size-4" aria-hidden /> {t("add")}
          </Button>
        )}
      </div>

      {questions.length === 0 && editing !== "new" && <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">{t("empty")}</p>}

      <ol className="grid gap-3">
        {questions.map((q, i) =>
          editing === q.id ? (
            <li key={q.id}>
              <QuestionForm exerciseId={exerciseId} questionId={q.id} initial={q.input} audioName={q.audioName} attachment={q.attachment} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={q.id} className="group flex gap-4 rounded-2xl border bg-card p-4 shadow-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">{t(`types.${q.type}`)}</span>
                  <span>{t("pointsCount", { count: q.points })}</span>
                  {q.attachment && (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="size-3" aria-hidden /> {q.attachment.name}
                    </span>
                  )}
                  {q.audioName && (
                    <span className="inline-flex items-center gap-1">
                      <Music className="size-3" aria-hidden /> {q.audioName}
                    </span>
                  )}
                </p>
                <p className="font-medium whitespace-pre-wrap">{q.prompt}</p>
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{q.type === "TRUE_FALSE" ? t(q.answer[0] === "true" ? "true" : "false") : q.answer.join(" · ")}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
                <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(q.id, "up")} aria-label={t("moveUp")}>
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" disabled={i === questions.length - 1} onClick={() => move(q.id, "down")} aria-label={t("moveDown")}>
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setEditing(q.id)} aria-label={t("edit")}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(q.id)} aria-label={t("delete")} className="text-destructive hover:text-destructive">
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ),
        )}
      </ol>

      {editing === "new" && <QuestionForm exerciseId={exerciseId} onDone={() => setEditing(null)} />}
    </section>
  );
}
