"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { MediaError, confirmUpload, createLocalVideo, createMuxVideo, deleteMedia, requestUpload, updateVideoDetails } from "@/features/media/service";
import { MEDIA_POLICY } from "@/features/media/policy";
import type { AuditContext } from "@/server/audit";
import { createAction, fail, type ActionResult } from "@/server/actions";
import { assertAdmin } from "@/server/dal/guards";
import { EDITABLE_BLOCK_KINDS } from "./blocks";
import {
  addBlock,
  ContentError,
  createLesson,
  createUnit,
  deleteBlock,
  deleteLesson,
  deleteUnit,
  reorder,
  saveBlock,
  updateLesson,
  updateUnit,
} from "./service";

/** Server Actions du CMS : toutes exigent un administrateur (2FA, session valide). */

const id = z.string().min(1).max(64);
const title = z.string().trim().min(2, "titleTooShort").max(160);
const summary = z.string().trim().max(500).optional();
const publication = {
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
  // Date/heure saisie dans le fuseau de l'administrateur, convertie en UTC côté client (ISO).
  publishAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "dateInvalid"),
};

async function actor(): Promise<AuditContext> {
  const admin = await assertAdmin();
  return { actorId: admin.userId, ip: admin.ip, userAgent: admin.userAgent };
}

async function run<T>(op: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await op();
    revalidatePath("/[locale]/admin/content", "layout");
    revalidatePath("/[locale]/app", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ContentError || err instanceof MediaError) return fail(err.code);
    throw err;
  }
}

// ── Unités / leçons ──────────────────────────────────────────────────────────

export const createUnitAction = createAction(z.object({ moduleId: id, title, summary }), async (input) => {
  const a = await actor();
  return run(async () => (await createUnit(a, input)).id);
});

export const updateUnitAction = createAction(z.object({ unitId: id, title, summary, ...publication }), async ({ unitId, ...input }) => {
  const a = await actor();
  return run(async () => (await updateUnit(a, unitId, input)).id);
});

export const deleteUnitAction = createAction(z.object({ unitId: id }), async ({ unitId }) => {
  const a = await actor();
  return run(() => deleteUnit(a, unitId));
});

export const createLessonAction = createAction(
  z.object({ unitId: id, title, type: z.enum(["TEXT", "VIDEO", "MIXED"]) }),
  async (input) => {
    const a = await actor();
    return run(async () => (await createLesson(a, input)).id);
  },
);

export const updateLessonAction = createAction(
  z.object({
    lessonId: id,
    title,
    summary,
    type: z.enum(["TEXT", "VIDEO", "MIXED"]),
    estimatedMinutes: z.coerce.number().int().min(1).max(240),
    xpReward: z.coerce.number().int().min(0).max(500),
    ...publication,
  }),
  async ({ lessonId, ...input }) => {
    const a = await actor();
    return run(async () => (await updateLesson(a, lessonId, input)).id);
  },
);

export const deleteLessonAction = createAction(z.object({ lessonId: id }), async ({ lessonId }) => {
  const a = await actor();
  return run(() => deleteLesson(a, lessonId));
});

export const reorderAction = createAction(
  z.object({ scope: z.enum(["unit", "lesson", "block"]), parentId: id, orderedIds: z.array(id).min(1).max(500) }),
  async ({ scope, parentId, orderedIds }) => {
    const a = await actor();
    return run(() => reorder(a, scope, parentId, orderedIds));
  },
);

// ── Blocs ────────────────────────────────────────────────────────────────────

export const addBlockAction = createAction(z.object({ lessonId: id, kind: z.enum(EDITABLE_BLOCK_KINDS as [string, ...string[]]) }), async ({ lessonId, kind }) => {
  const a = await actor();
  return run(async () => (await addBlock(a, lessonId, kind as (typeof EDITABLE_BLOCK_KINDS)[number])).id);
});

export const saveBlockAction = createAction(
  z.object({ blockId: id, content: z.unknown(), videoId: id.nullable().optional() }),
  async ({ blockId, content, videoId }) => {
    const a = await actor();
    return run(() => saveBlock(a, blockId, { content, videoId }));
  },
);

export const deleteBlockAction = createAction(z.object({ blockId: id }), async ({ blockId }) => {
  const a = await actor();
  return run(() => deleteBlock(a, blockId));
});

// ── Médias ───────────────────────────────────────────────────────────────────

export const requestUploadAction = createAction(
  z.object({
    purpose: z.enum(Object.keys(MEDIA_POLICY) as [keyof typeof MEDIA_POLICY, ...(keyof typeof MEDIA_POLICY)[]]),
    mime: z.string().max(100),
    size: z.number().int().positive(),
    name: z.string().max(255),
  }),
  async (input) => {
    const a = await actor();
    return run(() => requestUpload(a, input));
  },
);

export const confirmUploadAction = createAction(z.object({ mediaId: id }), async ({ mediaId }) => {
  const a = await actor();
  return run(async () => {
    const m = await confirmUpload(a, mediaId);
    return { id: m.id, name: m.originalName ?? "", mime: m.mime };
  });
});

export const createLocalVideoAction = createAction(z.object({ mediaId: id, title }), async (input) => {
  const a = await actor();
  return run(async () => (await createLocalVideo(a, input)).id);
});

export const createMuxVideoAction = createAction(z.object({ title }), async ({ title }) => {
  const a = await actor();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  return run(() => createMuxVideo(a, { title, origin }));
});

export const updateVideoAction = createAction(
  z.object({
    videoId: id,
    title,
    chapters: z.string().max(10_000).default(""),
    subtitlesEn: z.string().max(500_000).default(""),
    subtitlesFr: z.string().max(500_000).default(""),
  }),
  async ({ videoId, ...input }) => {
    const a = await actor();
    return run(() => updateVideoDetails(a, videoId, input));
  },
);

export const deleteMediaAction = createAction(z.object({ mediaId: id }), async ({ mediaId }) => {
  const a = await actor();
  const res = await run(() => deleteMedia(a, mediaId));
  if (res.ok && res.data && !res.data.deleted) return fail("MEDIA_IN_USE");
  return res;
});
