"use client";

import { CheckCircle2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, useSyncExternalStore } from "react";
import { echoed, Field, FormAlert, SubmitButton } from "@/components/forms";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { signUpAction } from "../actions";
import { PasswordStrength } from "./password-strength";

const selectClass =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

const DEFAULT_TZ = "Europe/Paris";
const noopSubscribe = () => () => {};

/**
 * Les listes de pays et de fuseaux sont calculées côté serveur et passées en props :
 * les données ICU de Node et du navigateur diffèrent, ce qui provoquerait un écart d'hydratation.
 * Les champs sont non contrôlés (robustes à une saisie avant hydratation) ; on écoute
 * seulement `onChange` pour l'indicateur de robustesse.
 */
export function SignUpForm({
  countries,
  timezones,
}: {
  countries: { code: string; name: string }[];
  timezones: string[];
}) {
  const t = useTranslations("auth.signUp");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const locale = useLocale();
  const [state, action] = useActionState(signUpAction, null);
  const [name, setName] = useState("");
  // Le mot de passe saisi est oublié à chaque nouvelle réponse du serveur (React vide le champ).
  const [typed, setTyped] = useState<{ for: typeof state; value: string }>({ for: null, value: "" });
  const password = typed.for === state ? typed.value : "";
  // Fuseau du navigateur côté client, valeur neutre au rendu serveur (pas d'écart d'hydratation).
  const detectedTimezone = useSyncExternalStore(
    noopSubscribe,
    () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz && timezones.includes(tz) ? tz : DEFAULT_TZ;
    },
    () => DEFAULT_TZ,
  );

  if (state?.ok) {
    return (
      <div className="space-y-4 text-center" role="status">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-brand-ink">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <h2 className="text-2xl font-medium">{t("successTitle")}</h2>
        <p className="text-muted-foreground">{t("successBody")}</p>
      </div>
    );
  }

  const consentError = state?.fieldErrors?.consent;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="locale" value={locale} />
      <Field
        name="name"
        label={t("name")}
        state={state}
        autoComplete="name"
        required
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        name="whatsapp"
        label={t("whatsapp")}
        hint={t("whatsappHint")}
        state={state}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="+33 6 12 34 56 78"
        required
        maxLength={32}
      />
      <Field name="email" label={tc("email")} state={state} type="email" autoComplete="email" required inputMode="email" />
      <div className="grid gap-2">
        <Field
          name="password"
          label={tc("password")}
          state={state}
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          onChange={(e) => setTyped({ for: state, value: e.target.value })}
        />
        <PasswordStrength password={password} userInputs={[name]} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="country" label={t("country")} state={state}>
          <select
            key={echoed(state, "country") ?? ""}
            id="field-country"
            name="country"
            className={selectClass}
            defaultValue={echoed(state, "country") ?? ""}
          >
            <option value="">{t("countryPlaceholder")}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field name="timezone" label={t("timezone")} state={state}>
          <select
            key={echoed(state, "timezone") ?? detectedTimezone}
            id="field-timezone"
            name="timezone"
            className={selectClass}
            defaultValue={echoed(state, "timezone") ?? detectedTimezone}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="consent"
            name="consent"
            value="on"
            aria-invalid={consentError ? true : undefined}
            aria-describedby={consentError ? "consent-error" : undefined}
            className="mt-0.5"
          />
          <Label htmlFor="consent" className="block text-sm leading-relaxed font-normal text-muted-foreground">
            {t.rich("consent", {
              privacy: (chunks) => (
                <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4" target="_blank">
                  {chunks}
                </Link>
              ),
            })}
          </Label>
        </div>
        {consentError && (
          <p id="consent-error" className="text-sm text-destructive">
            {tv("consentRequired")}
          </p>
        )}
      </div>
      <SubmitButton>{t("submit")}</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          {tc("signIn")}
        </Link>
      </p>
    </form>
  );
}
