"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/forms";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateLessonAction } from "../actions";
import { PublicationFields, type PubStatus } from "./publication";

export function LessonSettings({
  lesson,
}: {
  lesson: {
    id: string;
    title: string;
    summary: string | null;
    type: "TEXT" | "VIDEO" | "MIXED";
    estimatedMinutes: number;
    xpReward: number;
    status: PubStatus;
    publishAt: Date | null;
  };
}) {
  const t = useTranslations("admin.content");
  const [state, action] = useActionState(updateLessonAction, null);
  return (
    <form action={action} className="grid gap-4">
      <FormAlert state={state} success={t("saved")} />
      <input type="hidden" name="lessonId" value={lesson.id} />
      <Field name="title" label={t("fieldTitle")} state={state} defaultValue={lesson.title} required minLength={2} maxLength={160} />
      <div className="grid gap-2">
        <Label htmlFor="summary">{t("summary")}</Label>
        <Textarea id="summary" name="summary" defaultValue={lesson.summary ?? ""} maxLength={500} rows={2} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="type">{t("lessonTypeLabel")}</Label>
          <select id="type" name="type" defaultValue={lesson.type} className="h-11 rounded-md border border-input bg-background px-3 text-sm">
            {(["TEXT", "VIDEO", "MIXED"] as const).map((ty) => (
              <option key={ty} value={ty}>
                {t(`lessonType.${ty}`)}
              </option>
            ))}
          </select>
        </div>
        <Field name="estimatedMinutes" label={t("minutes")} state={state} type="number" min={1} max={240} defaultValue={lesson.estimatedMinutes} />
        <Field name="xpReward" label={t("xp")} state={state} type="number" min={0} max={500} defaultValue={lesson.xpReward} />
      </div>
      <PublicationFields status={lesson.status} publishAt={lesson.publishAt} />
      <SubmitButton className="w-fit">{t("save")}</SubmitButton>
    </form>
  );
}
