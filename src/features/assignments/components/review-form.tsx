"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { echoed, Field, FormAlert, SubmitButton } from "@/components/forms";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { reviewSubmissionAction } from "../actions";

/** Correction d'une copie : note sur 100 (facultative) et commentaire, puis retour à l'étudiant. */
export function ReviewForm({ submissionId, initial, nextHref }: { submissionId: string; initial?: { score: number | null; comment: string | null }; nextHref: string }) {
  const t = useTranslations("assignments.review");
  const router = useRouter();
  const [state, action] = useActionState(reviewSubmissionAction, null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(t("returned"));
      router.push(nextHref);
    }
  }, [state, router, nextHref, t]);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormAlert state={state?.ok ? null : state} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <Field name="score" label={t("score")} hint={t("scoreHint")} state={state} type="number" min={0} max={100} defaultValue={initial?.score != null ? String(initial.score) : ""} />
      <Field name="comment" label={t("comment")} state={state}>
        <Textarea id="field-comment" name="comment" rows={8} maxLength={5000} defaultValue={echoed(state, "comment") ?? initial?.comment ?? ""} placeholder={t("commentPlaceholder")} />
      </Field>
      <SubmitButton>
        <Send className="size-4" aria-hidden /> {t("submit")}
      </SubmitButton>
    </form>
  );
}
