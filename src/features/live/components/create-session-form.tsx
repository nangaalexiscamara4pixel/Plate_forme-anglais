"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { echoed, Field, FormAlert, SubmitButton } from "@/components/forms";
import { Textarea } from "@/components/ui/textarea";
import { createLiveSessionAction } from "../actions";

const selectClass =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

/** Programmation d'une séance en direct (date et heure dans le fuseau de l'administrateur). */
export function CreateSessionForm({ levels, defaultDate, timezone }: { levels: { id: string; code: string; name: string }[]; defaultDate: string; timezone: string }) {
  const t = useTranslations("live.admin");
  const [state, action] = useActionState(createLiveSessionAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(t("created"));
      formRef.current?.reset();
    }
  }, [state, t]);

  return (
    <form ref={formRef} action={action} className="grid gap-4" noValidate>
      <FormAlert state={state?.ok ? null : state} />
      <Field name="title" label={t("titleLabel")} state={state} required maxLength={120} placeholder={t("titlePlaceholder")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="levelId" label={t("level")} state={state}>
          <select id="field-levelId" name="levelId" className={selectClass} defaultValue={echoed(state, "levelId") ?? levels[0]?.id}>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} · {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field name="durationMin" label={t("duration")} state={state}>
          <select id="field-durationMin" name="durationMin" className={selectClass} defaultValue={echoed(state, "durationMin") ?? "60"}>
            {[30, 45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>
                {t("minutes", { count: m })}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="date" label={t("date")} state={state} type="date" required defaultValue={defaultDate} />
        <Field name="time" label={t("time")} state={state} type="time" required defaultValue="18:00" hint={t("timezoneHint", { timezone: timezone.replaceAll("_", " ") })} />
      </div>
      <Field name="description" label={t("descriptionLabel")} state={state}>
        <Textarea id="field-description" name="description" rows={3} maxLength={1000} defaultValue={echoed(state, "description")} placeholder={t("descriptionPlaceholder")} />
      </Field>
      <SubmitButton>{t("create")}</SubmitButton>
    </form>
  );
}
