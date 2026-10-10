import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";
import { env, isProd } from "@/env";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { resetPassword, verifyEmail } from "@/server/email/templates";
import { localeOf } from "@/server/locale";
import { onSignInFailure, onSignInSuccess, assertNotLocked } from "@/server/security/lockout";
import { notifyAdminsOfRegistration } from "@/features/approval/notify";
import { hashPassword, verifyPassword } from "@/server/password";

const ac = createAccessControl(defaultStatements);
const roles = {
  ADMIN: ac.newRole({ ...adminAc.statements }),
  STUDENT: ac.newRole({ ...userAc.statements }),
};

/** Chemins de Better Auth qui ne peuvent PAS être appelés directement en HTTP :
 *  ils passent obligatoirement par nos Server Actions (validation Zod, consentement RGPD,
 *  rate limiting applicatif). */
const SERVER_ACTION_ONLY_PATHS = new Set(["/sign-up/email"]);

export const auth = betterAuth({
  appName: "GlobeSpeak Academy",
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: prismaAdapter(db, { provider: "postgresql" }),
  telemetry: { enabled: false },

  user: {
    additionalFields: {
      status: { type: "string", required: false, defaultValue: "PENDING", input: false },
      currentLevelId: { type: "string", required: false, input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 jours glissants
    updateAge: 60 * 60 * 24, // renouvellement quotidien
    freshAge: 60 * 15, // opérations sensibles : connexion de moins de 15 min
    // Pas de cache cookie : chaque requête relit la session en base,
    // donc une révocation par l'administrateur est effective immédiatement.
  },

  verification: { storeIdentifier: "hashed" },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    password: { hash: hashPassword, verify: verifyPassword },
    sendResetPassword: async ({ user, url }) => {
      const locale = await localeOf(user.id);
      await sendEmail(user.email, resetPassword({ name: user.name, url, locale }));
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      const locale = await localeOf(user.id);
      await sendEmail(user.email, verifyEmail({ name: user.name, url, locale }));
    },
    afterEmailVerification: async (user) => {
      await notifyAdminsOfRegistration(user.id);
    },
  },

  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined,

  account: {
    encryptOAuthTokens: true,
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },

  databaseHooks: {
    user: {
      create: {
        // Quelle que soit la source (email ou Google), un nouveau compte est
        // TOUJOURS un étudiant en attente d'approbation.
        before: async (user) => ({
          data: { ...user, email: user.email.toLowerCase(), role: "STUDENT", status: "PENDING" },
        }),
        after: async (user) => {
          await db.profile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
          // Avec Google, l'email est déjà vérifié : l'admin est prévenu tout de suite.
          if (user.emailVerified) await notifyAdminsOfRegistration(user.id);
        },
      },
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (SERVER_ACTION_ONLY_PATHS.has(ctx.path) && ctx.request) {
        throw new APIError("FORBIDDEN", { message: "Not allowed" });
      }
      if (ctx.path === "/sign-in/email") {
        const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
        await assertNotLocked(email);
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
      const returned = ctx.context.returned;
      if (returned instanceof APIError) {
        if (returned.status === "UNAUTHORIZED") await onSignInFailure(email);
      } else {
        await onSignInSuccess(email);
      }
    }),
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
      "/request-password-reset": { window: 60 * 60, max: 3 },
      "/send-verification-email": { window: 60 * 10, max: 3 },
    },
  },

  advanced: {
    cookiePrefix: "gs",
    useSecureCookies: isProd,
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProd },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },

  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "STUDENT",
      adminRoles: ["ADMIN"],
      impersonationSessionDuration: 60 * 30,
      allowImpersonatingAdmins: false,
    }),
    twoFactor({
      issuer: "GlobeSpeak Academy",
      backupCodeOptions: { amount: 10, length: 10 },
    }),
    nextCookies(), // doit rester en dernier
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
