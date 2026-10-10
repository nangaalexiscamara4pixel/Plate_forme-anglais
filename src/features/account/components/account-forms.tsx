"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/forms";
import { PasswordStrength } from "@/features/auth/components/password-strength";
import { changeOwnPasswordAction, revokeOtherOwnSessionsAction } from "../actions";

export function ChangePasswordForm({ userInputs }: { userInputs: string[] }) {
  const t = useTranslations("admin.account");
  const [state, action] = useActionState(changeOwnPasswordAction, null);
  const [typed, setTyped] = useState<{ for: typeof state; value: string }>({ for: null, value: "" });
  const password = typed.for === state ? typed.value : "";

  return (
    <form action={action} className="grid max-w-md gap-4">
      <FormAlert state={state} success={t("passwordChanged")} />
      <Field name="currentPassword" label={t("currentPassword")} state={state} type="password" autoComplete="current-password" required />
      <div className="grid gap-2">
        <Field
          name="newPassword"
          label={t("newPassword")}
          state={state}
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          onChange={(e) => setTyped({ for: state, value: e.target.value })}
        />
        <PasswordStrength password={password} userInputs={userInputs} />
      </div>
      <SubmitButton className="w-fit">{t("changePassword")}</SubmitButton>
    </form>
  );
}

export function RevokeOtherSessionsForm() {
  const t = useTranslations("admin.account");
  const [state, action] = useActionState(revokeOtherOwnSessionsAction, null);
  return (
    <form action={action} className="grid gap-3">
      <FormAlert state={state} success={t("othersRevoked")} />
      <SubmitButton variant="outline" className="w-fit">
        {t("revokeOthers")}
      </SubmitButton>
    </form>
  );
}
