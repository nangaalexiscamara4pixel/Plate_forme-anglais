"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { echoed, Field, FormAlert, SubmitButton } from "@/components/forms";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { createExerciseAction, updateExerciseAction } from "../actions";

export const selectClass =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

export type ExerciseValues = {
  id: string;
  title: string;
  instructions: string | null;
  levelId: string | null;
  kind: string;
  passingScore: number;
  maxAttempts: number | null;
  timeLimitSec: number | null;
  shuffle: boolean;
};

/** Paramètres d'un exercice : création (puis ouverture de l'éditeur de questions) ou modification. */
export function ExerciseForm({ levels, exercise }: { levels: { id: string; code: string; name: string }[]; exercise?: ExerciseValues }) {
  const t = useTranslations("exercises.admin");
  const router = useRouter();
  // Même formulaire pour la création (renvoie l'identifiant) et la modification.
  const submit = (exercise ? updateExerciseAction : createExerciseAction) as unknown as typeof createExerciseAction;
  const [state, action] = useActionState(submit, null);
  useEffect(() => {
    if (!state?.ok) return;
    if (exercise) toast.success(t("saved"));
    else if (typeof state.data === "string") router.push(`/admin/exercises/${state.data}`);
  }, [state, exercise, router, t]);
  const value = (name: string, fallback: string) => echoed(state, name) ?? fallback;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormAlert state={state?.ok ? null : state} />
      {exercise && <input type="hidden" name="id" value={exercise.id} />}
      <Field name="title" label={t("title")} state={state} required maxLength={150} defaultValue={exercise?.title} placeholder={t("titlePlaceholder")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="levelId" label={t("level")} state={state}>
          <select id="field-levelId" name="levelId" className={selectClass} defaultValue={value("levelId", exercise?.levelId ?? levels[0]?.id ?? "")}>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} · {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field name="kind" label={t("kind")} state={state}>
          <select id="field-kind" name="kind" className={selectClass} defaultValue={value("kind", exercise?.kind ?? "PRACTICE")}>
            {(["PRACTICE", "UNIT_QUIZ", "LEVEL_EXAM"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="passingScore" label={t("passingScore")} state={state} type="number" min={0} max={100} required defaultValue={String(exercise?.passingScore ?? 70)} />
        <Field name="maxAttempts" label={t("maxAttempts")} state={state} type="number" min={1} max={50} defaultValue={exercise?.maxAttempts ? String(exercise.maxAttempts) : ""} placeholder={t("unlimited")} />
        <Field name="timeLimitMin" label={t("timeLimit")} state={state} type="number" min={1} max={240} defaultValue={exercise?.timeLimitSec ? String(exercise.timeLimitSec / 60) : ""} placeholder={t("noLimit")} />
      </div>
      <Field name="instructions" label={t("instructions")} state={state}>
        <Textarea id="field-instructions" name="instructions" rows={3} maxLength={2000} defaultValue={echoed(state, "instructions") ?? exercise?.instructions ?? ""} placeholder={t("instructionsPlaceholder")} />
      </Field>
      <div className="flex items-center gap-3">
        <Checkbox id="field-shuffle" name="shuffle" value="on" defaultChecked={exercise?.shuffle ?? false} />
        <Label htmlFor="field-shuffle" className="font-normal">
          {t("shuffle")}
        </Label>
      </div>
      <SubmitButton>{exercise ? t("save") : t("create")}</SubmitButton>
    </form>
  );
}
