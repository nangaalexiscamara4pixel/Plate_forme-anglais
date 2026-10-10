"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { emailSchema } from "@/features/auth/schemas";
import { createAction, fail } from "@/server/actions";
import { rateLimit } from "@/server/security/rate-limit";
import { subscribe } from "./newsletter";

export const subscribeNewsletterAction = createAction(
  z.object({
    email: emailSchema,
    locale: z.enum(["fr", "en"]),
    consent: z.literal("on", { error: "consentRequired" }),
    // Champ piège invisible : rempli uniquement par les robots.
    website: z.string().max(0).optional().or(z.literal("")),
  }),
  async ({ email, locale }) => {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimit("newsletter", ip)).ok) return fail("tooManyAttempts");
    await subscribe(email, locale);
    return { ok: true };
  },
);
