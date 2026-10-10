"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { completeLessonAction } from "../actions";

export function CompleteLessonButton({ lessonId, completed, readOnly }: { lessonId: string; completed: boolean; readOnly: boolean }) {
  const t = useTranslations("learn");
  const [state, action, pending] = useActionState(completeLessonAction, null);
  const done = completed || state?.ok === true;
  if (done) {
    return (
      <p className="inline-flex items-center gap-2 font-medium text-success" role="status">
        <CheckCircle2 className="size-5" aria-hidden /> {t("lessonCompleted")}
      </p>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <Button type="submit" size="lg" disabled={pending || readOnly} title={readOnly ? t("readOnly") : undefined}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
        {t("markComplete")}
      </Button>
    </form>
  );
}
