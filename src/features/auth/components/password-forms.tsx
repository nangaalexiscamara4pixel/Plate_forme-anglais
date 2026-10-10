"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { forgotPasswordAction, resendVerificationAction, resetPasswordAction } from "../actions";
import { PasswordStrength } from "./password-strength";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const tc = useTranslations("common");
  const [state, action] = useActionState(forgotPasswordAction, null);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormAlert state={state} success={t("sent")} />
      <Field name="email" label={tc("email")} state={state} type="email" autoComplete="email" required />
      <SubmitButton>{t("submit")}</SubmitButton>
      <Link href="/sign-in" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
        {t("back")}
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.reset");
  const tc = useTranslations("common");
  const [state, action] = useActionState(resetPasswordAction, null);
  const [typed, setTyped] = useState<{ for: typeof state; value: string }>({ for: null, value: "" });
  const password = typed.for === state ? typed.value : "";

  if (state?.ok) {
    return (
      <div className="grid gap-5">
        <FormAlert state={state} success={t("success")} />
        <Button asChild size="lg">
          <Link href="/sign-in">{tc("signIn")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-2">
        <Field
          name="password"
          label={tc("password")}
          state={state}
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          onChange={(e) => setTyped({ for: state, value: e.target.value })}
        />
        <PasswordStrength password={password} />
      </div>
      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}

export function ResendVerificationForm() {
  const t = useTranslations("auth.verifyEmail");
  const tc = useTranslations("common");
  const [state, action] = useActionState(resendVerificationAction, null);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormAlert state={state} success={t("sent")} />
      <Field name="email" label={tc("email")} state={state} type="email" autoComplete="email" required />
      <SubmitButton variant="outline">{t("submit")}</SubmitButton>
    </form>
  );
}
