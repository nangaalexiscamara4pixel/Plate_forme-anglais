"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/forms";
import { Link } from "@/i18n/navigation";
import { signInAction } from "../actions";

export function SignInForm({ next }: { next?: string }) {
  const t = useTranslations("auth.signIn");
  const tc = useTranslations("common");
  const [state, action] = useActionState(signInAction, null);

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormAlert state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="email" label={tc("email")} state={state} type="email" autoComplete="email" required inputMode="email" />
      <div className="grid gap-2">
        <Field
          name="password"
          label={tc("password")}
          state={state}
          type="password"
          autoComplete="current-password"
          required
        />
        <Link href="/forgot-password" className="justify-self-end text-sm text-muted-foreground underline-offset-4 hover:underline">
          {t("forgot")}
        </Link>
      </div>
      <SubmitButton>{t("submit")}</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline">
          {tc("requestAccess")}
        </Link>
      </p>
    </form>
  );
}
