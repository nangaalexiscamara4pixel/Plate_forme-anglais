"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { changeAccountStatus, StatusChangeError } from "@/features/approval/service";
import type { AuditContext } from "@/server/audit";
import { createAction, fail, type ActionResult } from "@/server/actions";
import { assertAdmin } from "@/server/dal/guards";
import {
  changeStudentLevel,
  revokeAllSessions,
  revokeOneSession,
  sendStudentPasswordReset,
  StudentOpError,
} from "./service";

const id = z.string().min(1).max(64);

async function adminContext(): Promise<AuditContext> {
  const admin = await assertAdmin();
  return { actorId: admin.userId, ip: admin.ip, userAgent: admin.userAgent };
}

function refresh() {
  revalidatePath("/[locale]/admin", "layout");
}

async function run(op: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await op();
  } catch (err) {
    if (err instanceof StatusChangeError || err instanceof StudentOpError) return fail(err.code);
    throw err;
  }
  refresh();
  return { ok: true };
}

export const setStudentStatusAction = createAction(
  z.object({
    studentId: id,
    status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
    levelId: id.optional().or(z.literal("").transform(() => undefined)),
    reason: z.string().trim().max(500).optional(),
  }),
  async (input) => {
    const actor = await adminContext();
    return run(() => changeAccountStatus(actor, input));
  },
);

export const changeLevelAction = createAction(
  z.object({ studentId: id, levelId: id, mode: z.enum(["promote", "reassign"]) }),
  async (input) => {
    const actor = await adminContext();
    return run(() => changeStudentLevel(actor, input));
  },
);

export const revokeAllSessionsAction = createAction(z.object({ studentId: id }), async ({ studentId }) => {
  const actor = await adminContext();
  return run(() => revokeAllSessions(actor, studentId));
});

export const revokeSessionAction = createAction(
  z.object({ studentId: id, sessionId: id }),
  async ({ studentId, sessionId }) => {
    const actor = await adminContext();
    return run(() => revokeOneSession(actor, studentId, sessionId));
  },
);

export const sendPasswordResetAction = createAction(z.object({ studentId: id }), async ({ studentId }) => {
  const actor = await adminContext();
  return run(() => sendStudentPasswordReset(actor, studentId));
});
