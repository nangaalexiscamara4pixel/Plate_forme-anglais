"use client";

import { Mic, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { echoed, Field, FormAlert, SubmitButton } from "@/components/forms";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/features/exercises/components/exercise-form";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { createAssignmentAction, updateAssignmentAction } from "../actions";

export type AssignmentValues = {
  id: string;
  title: string;
  prompt: string;
  skill: "WRITING" | "SPEAKING";
  levelId: string | null;
  minWords: number | null;
  maxWords: number | null;
  maxDurationSec: number | null;
};

/** Paramètres d'un devoir : expression écrite (nombre de mots) ou orale (durée maximale). */
export function AssignmentForm({ levels, assignment }: { levels: { id: string; code: string; name: string }[]; assignment?: AssignmentValues }) {
  const t = useTranslations("assignments.admin");
  const router = useRouter();
  const submit = (assignment ? updateAssignmentAction : createAssignmentAction) as unknown as typeof createAssignmentAction;
  const [state, action] = useActionState(submit, null);
  const [skill, setSkill] = useState<"WRITING" | "SPEAKING">(assignment?.skill ?? "WRITING");
  useEffect(() => {
    if (!state?.ok) return;
    if (assignment) toast.success(t("saved"));
    else if (typeof state.data === "string") router.push(`/admin/assignments/${state.data}`);
  }, [state, assignment, router, t]);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormAlert state={state?.ok ? null : state} />
      {assignment && <input type="hidden" name="id" value={assignment.id} />}
      <input type="hidden" name="skill" value={skill} />
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t("skill")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["WRITING", "SPEAKING"] as const).map((s) => {
            const Icon = s === "WRITING" ? PenLine : Mic;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={skill === s}
                onClick={() => setSkill(s)}
                className={cn("flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium", skill === s ? "border-brand bg-brand/5" : "border-border hover:bg-muted")}
              >
                <Icon className="size-4" aria-hidden /> {t(`skills.${s}`)}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Field name="title" label={t("title")} state={state} required maxLength={150} defaultValue={assignment?.title} placeholder={t("titlePlaceholder")} />
      <Field name="levelId" label={t("level")} state={state}>
        <select id="field-levelId" name="levelId" className={selectClass} defaultValue={echoed(state, "levelId") ?? assignment?.levelId ?? levels[0]?.id}>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} · {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field name="prompt" label={t("prompt")} state={state}>
        <Textarea
          id="field-prompt"
          name="prompt"
          rows={5}
          maxLength={5000}
          defaultValue={echoed(state, "prompt") ?? assignment?.prompt ?? ""}
          placeholder={t(skill === "WRITING" ? "promptPlaceholderWriting" : "promptPlaceholderSpeaking")}
          aria-invalid={state?.ok === false && !!state.fieldErrors?.prompt}
        />
      </Field>
      {skill === "WRITING" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="minWords" label={t("minWords")} state={state} type="number" min={1} max={5000} defaultValue={assignment?.minWords ? String(assignment.minWords) : ""} placeholder={t("optional")} />
          <Field name="maxWords" label={t("maxWords")} state={state} type="number" min={1} max={5000} defaultValue={assignment?.maxWords ? String(assignment.maxWords) : ""} placeholder={t("optional")} />
        </div>
      ) : (
        <Field name="maxDurationMin" label={t("maxDuration")} state={state} type="number" min={1} max={30} defaultValue={assignment?.maxDurationSec ? String(assignment.maxDurationSec / 60) : "2"} />
      )}
      <SubmitButton>{assignment ? t("save") : t("create")}</SubmitButton>
    </form>
  );
}
