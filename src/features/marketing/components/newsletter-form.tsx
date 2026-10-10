"use client";

import { Loader2, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { subscribeNewsletterAction } from "../actions";

export function NewsletterForm() {
  const t = useTranslations("site.footer");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [state, action, pending] = useActionState(subscribeNewsletterAction, null);

  if (state?.ok) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {t("newsletterSent")}
      </p>
    );
  }
  const error = state && !state.ok ? (state.fieldErrors?.consent ? t("consentRequired") : state.fieldErrors?.email ? t("emailInvalid") : te.has(state.error) ? te(state.error) : te("generic")) : null;

  return (
    <form action={action} className="grid gap-3" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {/* Champ piège pour les robots : invisible et ignoré des lecteurs d'écran */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="flex gap-2">
        <Input type="email" name="email" required autoComplete="email" placeholder={t("emailPlaceholder")} aria-label={t("emailPlaceholder")} className="bg-background" />
        <Button type="submit" disabled={pending} className="bg-gold text-night hover:bg-gold/90">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {t("subscribe")}
        </Button>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox id="nl-consent" name="consent" value="on" className="mt-0.5" />
        <Label htmlFor="nl-consent" className="block text-xs leading-relaxed font-normal text-muted-foreground">
          {t.rich("consent", {
            privacy: (chunks) => (
              <Link href="/privacy" className="underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
        </Label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
