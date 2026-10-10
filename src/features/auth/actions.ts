"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { env } from "@/env";
import { redirect } from "@/i18n/navigation";
import { MIN_PASSWORD_SCORE, passwordScore } from "@/lib/password-strength";
import { createAction, fail, type ActionResult } from "@/server/actions";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getViewer } from "@/server/dal/viewer";
import { rateLimit } from "@/server/security/rate-limit";
import { destinationFor } from "./destination";
import {
  backupCodeSchema,
  enableTwoFactorSchema,
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  totpSchema,
} from "./schemas";

const POLICY_VERSION = "2026-10";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

async function go(href: string): Promise<never> {
  return redirect({ href, locale: await getLocale() });
}

async function redirectAfterSignIn(email: string, next?: string): Promise<never> {
  const user = await db.user.findUniqueOrThrow({
    where: { email },
    select: { role: true, status: true, twoFactorEnabled: true },
  });
  return go(destinationFor(user, next));
}

// ── Inscription ───────────────────────────────────────────────────────────────

export const signUpAction = createAction(signUpSchema, async (input): Promise<ActionResult> => {
  const limit = await rateLimit("signUp", await clientIp());
  if (!limit.ok) return fail("tooManyAttempts");

  if ((await passwordScore(input.password, [input.name, input.email])) < MIN_PASSWORD_SCORE) {
    return fail("validation", { password: ["passwordWeak"] });
  }

  const result = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password, callbackURL: "/pending" },
    headers: await headers(),
  });

  // Si l'email existe déjà, Better Auth renvoie un utilisateur fictif (anti-énumération) :
  // updateMany n'affecte alors aucune ligne et la réponse reste identique.
  await db.profile.updateMany({
    where: { userId: result.user.id },
    data: {
      country: input.country ?? null,
      whatsapp: input.whatsapp,
      timezone: input.timezone,
      uiLocale: input.locale,
      privacyConsentAt: new Date(),
      privacyPolicyVersion: POLICY_VERSION,
    },
  });

  return { ok: true };
});

// ── Connexion ─────────────────────────────────────────────────────────────────

export const signInAction = createAction(signInSchema, async ({ email, password, next }) => {
  const limit = await rateLimit("signIn", `${await clientIp()}|${email}`);
  if (!limit.ok) return fail("tooManyAttempts");

  try {
    const res = await auth.api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: await headers(),
    });
    if ("twoFactorRedirect" in res && res.twoFactorRedirect) {
      return go(next ? `/two-factor?next=${encodeURIComponent(next)}` : "/two-factor");
    }
  } catch (err) {
    if (isAPIError(err)) {
      if (err.statusCode === 401) return fail("invalidCredentials");
      if (err.statusCode === 403) return fail("emailNotVerified");
      if (err.statusCode === 429) return fail("tooManyAttempts");
    }
    throw err;
  }
  return redirectAfterSignIn(email, next);
});

export const verifyTotpAction = createAction(totpSchema, async ({ code, next }) => {
  const limit = await rateLimit("twoFactor", await clientIp());
  if (!limit.ok) return fail("tooManyAttempts");
  try {
    const res = await auth.api.verifyTOTP({ body: { code, trustDevice: false }, headers: await headers() });
    return redirectAfterSignIn(res.user.email, next);
  } catch (err) {
    if (isAPIError(err) && err.statusCode !== 429) return fail("totpInvalid");
    throw err;
  }
});

export const verifyBackupCodeAction = createAction(backupCodeSchema, async ({ code, next }) => {
  const limit = await rateLimit("twoFactor", await clientIp());
  if (!limit.ok) return fail("tooManyAttempts");
  try {
    const res = await auth.api.verifyBackupCode({ body: { code, trustDevice: false }, headers: await headers() });
    return redirectAfterSignIn(res.user.email, next);
  } catch (err) {
    if (isAPIError(err) && err.statusCode !== 429) return fail("backupCodeInvalid");
    throw err;
  }
});

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  await go("/");
}

// ── Mot de passe oublié ──────────────────────────────────────────────────────

export const forgotPasswordAction = createAction(forgotPasswordSchema, async ({ email }) => {
  const limit = await rateLimit("passwordReset", `${await clientIp()}|${email}`);
  if (!limit.ok) return fail("tooManyAttempts");
  // Réponse identique que le compte existe ou non (anti-énumération).
  await auth.api.requestPasswordReset({ body: { email, redirectTo: `${env.APP_URL}/reset-password` } }).catch(() => null);
  return { ok: true };
});

export const resetPasswordAction = createAction(resetPasswordSchema, async ({ token, password }) => {
  if ((await passwordScore(password)) < MIN_PASSWORD_SCORE) {
    return fail("validation", { password: ["passwordWeak"] });
  }
  try {
    await auth.api.resetPassword({ body: { token, newPassword: password } });
  } catch (err) {
    if (isAPIError(err)) return fail("resetTokenInvalid");
    throw err;
  }
  return { ok: true };
});

export const resendVerificationAction = createAction(resendVerificationSchema, async ({ email }) => {
  const limit = await rateLimit("resendVerification", `${await clientIp()}|${email}`);
  if (!limit.ok) return fail("tooManyAttempts");
  await auth.api.sendVerificationEmail({ body: { email, callbackURL: "/pending" } }).catch(() => null);
  return { ok: true };
});

// ── Activation de la double authentification ────────────────────────────────

export const enableTwoFactorAction = createAction(
  enableTwoFactorSchema,
  async ({ password }): Promise<ActionResult<{ totpURI: string; backupCodes: string[] }>> => {
    const viewer = await getViewer();
    if (!viewer || viewer.impersonatedBy) return fail("forbidden");
    try {
      const res = await auth.api.enableTwoFactor({ body: { password }, headers: await headers() });
      if (!("totpURI" in res)) return fail("generic");
      return { ok: true, data: { totpURI: res.totpURI, backupCodes: res.backupCodes } };
    } catch (err) {
      if (isAPIError(err)) return fail("invalidPassword");
      throw err;
    }
  },
);

export const confirmTwoFactorAction = createAction(totpSchema, async ({ code }) => {
  const viewer = await getViewer();
  if (!viewer || viewer.impersonatedBy) return fail("forbidden");
  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
  } catch (err) {
    if (isAPIError(err)) return fail("totpInvalid");
    throw err;
  }
  return redirectAfterSignIn(viewer.email);
});
