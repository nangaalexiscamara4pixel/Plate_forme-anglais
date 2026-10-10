"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
} | null;

/** Valeur à réafficher après une erreur (React réinitialise les champs non contrôlés). */
export function echoed(state: FormState, name: string): string | undefined {
  return state && !state.ok ? state.values?.[name] : undefined;
}

export function SubmitButton({ children, className, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className={cn("w-full", className)} {...props}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

/** Message global d'erreur ou de succès, annoncé aux lecteurs d'écran. */
export function FormAlert({ state, success }: { state: FormState; success?: ReactNode }) {
  const t = useTranslations("errors");
  if (!state) return null;
  if (state.ok) {
    return success ? (
      <Alert className="border-success/30 text-success" role="status">
        <CheckCircle2 aria-hidden />
        <AlertDescription className="text-foreground">{success}</AlertDescription>
      </Alert>
    ) : null;
  }
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle aria-hidden />
      <AlertDescription>{t.has(state.error ?? "generic") ? t(state.error ?? "generic") : t("generic")}</AlertDescription>
    </Alert>
  );
}

export function Field({
  name,
  label,
  state,
  hint,
  className,
  children,
  defaultValue,
  ...inputProps
}: { name: string; label: ReactNode; state?: FormState; hint?: ReactNode; children?: ReactNode } & ComponentProps<
  typeof Input
>) {
  const t = useTranslations("validation");
  const errors = state?.fieldErrors?.[name];
  const id = inputProps.id ?? `field-${name}`;
  const describedBy = [errors?.length ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ");
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children ?? (
        <Input
          id={id}
          name={name}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="h-11"
          defaultValue={inputProps.value === undefined ? (echoed(state ?? null, name) ?? defaultValue) : undefined}
          {...inputProps}
        />
      )}
      {hint && !errors?.length && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errors.map((e) => (t.has(e) ? t(e) : e)).join(" ")}
        </p>
      ) : null}
    </div>
  );
}
