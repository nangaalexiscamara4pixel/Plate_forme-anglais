"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, fail } from "@/server/actions";
import { assertAdmin } from "@/server/dal/guards";
import { changeAccountStatus, StatusChangeError } from "./service";

const statusChangeSchema = z.object({
  studentId: z.string().min(1).max(64),
  status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
  levelId: z
    .string()
    .max(64)
    .optional()
    .transform((v) => v || undefined),
  reason: z.string().trim().max(500).optional(),
});

export const changeStatusAction = createAction(statusChangeSchema, async (input) => {
  const admin = await assertAdmin();
  try {
    await changeAccountStatus(
      { actorId: admin.userId, ip: admin.ip, userAgent: admin.userAgent },
      input,
    );
  } catch (err) {
    if (err instanceof StatusChangeError) return fail(err.code);
    throw err;
  }
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
});
