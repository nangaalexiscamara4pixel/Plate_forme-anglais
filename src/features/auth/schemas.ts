import { z } from "zod";

/**
 * Schémas partagés client/serveur. Les messages sont des clés de traduction
 * (namespace "validation"), traduites à l'affichage.
 */
export const PASSWORD_MIN = 12;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "emailInvalid")
  .pipe(z.email("emailInvalid"));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, "passwordTooShort")
  .max(128, "passwordTooLong")
  .refine((v) => /[a-zA-Z]/.test(v) && /[^a-zA-Z]/.test(v), "passwordTooSimple");

/** Chemin de redirection interne uniquement (empêche les redirections ouvertes). */
export const nextPathSchema = z
  .string()
  .optional()
  .transform((v) => (v && /^\/(?!\/)[\w\-/?=&%.]*$/.test(v) && !v.includes("\\") ? v : undefined));

const timezoneSchema = z
  .string()
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "timezoneInvalid");

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong"),
  email: emailSchema,
  password: passwordSchema,
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "countryInvalid")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  timezone: timezoneSchema,
  locale: z.enum(["fr", "en"]),
  consent: z.literal("on", { error: "consentRequired" }),
});
export type SignUpInput = z.input<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "required").max(128),
  next: nextPathSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(512),
  password: passwordSchema,
});

export const totpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "totpInvalid"),
  next: nextPathSchema,
});

export const backupCodeSchema = z.object({
  code: z.string().trim().min(8, "backupCodeInvalid").max(32, "backupCodeInvalid"),
  next: nextPathSchema,
});

export const enableTwoFactorSchema = z.object({ password: z.string().min(1, "required").max(128) });

export const resendVerificationSchema = z.object({ email: emailSchema });
