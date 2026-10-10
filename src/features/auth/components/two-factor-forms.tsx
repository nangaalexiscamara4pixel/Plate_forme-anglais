"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Copy, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useActionState, useEffect, useState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  confirmTwoFactorAction,
  enableTwoFactorAction,
  verifyBackupCodeAction,
  verifyTotpAction,
} from "../actions";

function OtpInput({ name, label }: { name: string; label: string }) {
  return (
    <InputOTP name={name} maxLength={6} pattern={REGEXP_ONLY_DIGITS} autoFocus aria-label={label} containerClassName="justify-center">
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

export function TwoFactorChallenge({ next }: { next?: string }) {
  const t = useTranslations("auth.twoFactor");
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [totpState, totpAction] = useActionState(verifyTotpAction, null);
  const [backupState, backupAction] = useActionState(verifyBackupCodeAction, null);

  return mode === "totp" ? (
    <form action={totpAction} className="grid gap-6">
      <FormAlert state={totpState} />
      {next && <input type="hidden" name="next" value={next} />}
      <OtpInput name="code" label={t("subtitle")} />
      <SubmitButton>{t("submit")}</SubmitButton>
      <Button type="button" variant="link" onClick={() => setMode("backup")}>
        {t("useBackup")}
      </Button>
    </form>
  ) : (
    <form action={backupAction} className="grid gap-6">
      <FormAlert state={backupState} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="code" label={t("backupLabel")} state={backupState} autoComplete="one-time-code" autoFocus />
      <SubmitButton>{t("submit")}</SubmitButton>
      <Button type="button" variant="link" onClick={() => setMode("totp")}>
        {t("useTotp")}
      </Button>
    </form>
  );
}

export function TwoFactorSetup() {
  const t = useTranslations("auth.setup2fa");
  const tc = useTranslations("common");
  const [enableState, enableAction] = useActionState(enableTwoFactorAction, null);
  const [confirmState, confirmAction] = useActionState(confirmTwoFactorAction, null);
  const [qr, setQr] = useState<string | null>(null);

  const setup = enableState?.ok ? enableState.data : undefined;
  const secret = setup ? (new URL(setup.totpURI).searchParams.get("secret") ?? "") : "";

  useEffect(() => {
    if (!setup) return;
    QRCode.toDataURL(setup.totpURI, { margin: 1, width: 220, color: { dark: "#0B1B3A", light: "#FFFFFF" } }).then(setQr);
  }, [setup]);

  if (!setup) {
    return (
      <form action={enableAction} className="grid gap-5">
        <FormAlert state={enableState} />
        <p className="text-sm font-medium">1. {t("step1")}</p>
        <Field name="password" label={tc("password")} state={enableState} type="password" autoComplete="current-password" required />
        <SubmitButton>{tc("continue")}</SubmitButton>
      </form>
    );
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        <p className="text-sm font-medium">2. {t("step2")}</p>
        <div className="mx-auto rounded-xl border bg-white p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL générée localement
            <img src={qr} alt="QR code" width={220} height={220} />
          ) : (
            <div className="size-[220px] animate-pulse bg-muted" />
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {t("manual")}{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground select-all">{secret}</code>
        </p>
      </section>

      <section className="grid gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-sm font-semibold">{t("backupTitle")}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigator.clipboard.writeText(setup.backupCodes.join("\n"))}
          >
            <Copy className="size-4" aria-hidden />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("backupBody")}</p>
        <ul className="grid grid-cols-2 gap-1.5 font-mono text-sm">
          {setup.backupCodes.map((c) => (
            <li key={c} className="rounded bg-muted px-2 py-1 text-center">
              {c}
            </li>
          ))}
        </ul>
      </section>

      <form action={confirmAction} className="grid gap-5">
        <p className="text-sm font-medium">3. {t("step3")}</p>
        <FormAlert state={confirmState} />
        <OtpInput name="code" label={t("step3")} />
        <SubmitButton>
          <ShieldCheck className="size-4" aria-hidden /> {t("confirm")}
        </SubmitButton>
      </form>
    </div>
  );
}
