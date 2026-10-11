"use server";

import { TZDate } from "@date-fns/tz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit";
import { createAction, fail, type ActionResult } from "@/server/actions";
import { db } from "@/server/db";
import { assertAdmin, AuthorizationError } from "@/server/dal/guards";
import { publish } from "@/server/realtime";
import { rateLimit } from "@/server/security/rate-limit";
import { CHAT_MAX_LENGTH, REACTION_KEYS } from "./rules";
import { createVideoAccess, resolveRoom, type VideoAccess } from "./server";

/**
 * Actions de la salle virtuelle. Chacune repasse par `resolveRoom` (session, statut, niveau,
 * fenêtre d'ouverture) : un identifiant de séance envoyé par le navigateur ne suffit jamais.
 * Les écritures sont refusées pendant une impersonation (lecture seule).
 */
const id = z.string().min(1).max(64);

async function hostRoom(sessionId: string) {
  const room = await resolveRoom(sessionId, { mutation: true });
  if (room.role !== "host") throw new AuthorizationError("FORBIDDEN");
  return room;
}

// ── Vidéo ──

export const joinVideoAction = createAction(z.object({ sessionId: id }), async ({ sessionId }): Promise<ActionResult<VideoAccess>> => {
  const { viewer, role } = await resolveRoom(sessionId, { mutation: true });
  if (role === "student") {
    // Présence enregistrée pour le suivi d'assiduité (l'enseignant valide ensuite).
    await db.attendance.upsert({
      where: { sessionId_userId: { sessionId, userId: viewer.userId } },
      create: { sessionId, userId: viewer.userId, joinClickedAt: new Date() },
      update: { joinClickedAt: new Date() },
    });
  }
  return { ok: true, data: await createVideoAccess(viewer, sessionId, role) };
});

// ── Chat ──

export const sendChatMessageAction = createAction(
  z.object({ sessionId: id, body: z.string().trim().min(1, "required").max(CHAT_MAX_LENGTH, "messageTooLong") }),
  async ({ sessionId, body }) => {
    const { viewer, role } = await resolveRoom(sessionId, { mutation: true });
    if (!(await rateLimit("liveChat", viewer.userId)).ok) return fail("tooManyAttempts");
    const message = await db.liveChatMessage.create({
      data: { sessionId, userId: viewer.userId, body },
      select: { id: true, createdAt: true },
    });
    await publish(sessionId, {
      type: "chat",
      message: { id: message.id, userId: viewer.userId, author: viewer.name, authorRole: role, body, createdAt: message.createdAt.toISOString(), likes: 0 },
    });
    return { ok: true };
  },
);

export const toggleLikeAction = createAction(z.object({ messageId: id }), async ({ messageId }) => {
  const message = await db.liveChatMessage.findUnique({ where: { id: messageId }, select: { sessionId: true, deletedAt: true } });
  if (!message || message.deletedAt) return fail("notFound");
  const { viewer } = await resolveRoom(message.sessionId, { mutation: true });
  if (!(await rateLimit("liveReaction", viewer.userId)).ok) return fail("tooManyAttempts");
  const key = { messageId_userId: { messageId, userId: viewer.userId } };
  const existing = await db.liveChatLike.findUnique({ where: key, select: { userId: true } });
  if (existing) await db.liveChatLike.delete({ where: key });
  else await db.liveChatLike.create({ data: { messageId, userId: viewer.userId } });
  const likes = await db.liveChatLike.count({ where: { messageId } });
  await publish(message.sessionId, { type: "like", messageId, likes, userId: viewer.userId, liked: !existing });
  return { ok: true };
});

export const deleteChatMessageAction = createAction(z.object({ messageId: id }), async ({ messageId }) => {
  const message = await db.liveChatMessage.findUnique({ where: { id: messageId }, select: { sessionId: true, userId: true, deletedAt: true } });
  if (!message || message.deletedAt) return fail("notFound");
  const { viewer } = await hostRoom(message.sessionId);
  await db.liveChatMessage.update({ where: { id: messageId }, data: { deletedAt: new Date(), deletedById: viewer.userId } });
  await audit({ actorId: viewer.userId, ip: viewer.ip, userAgent: viewer.userAgent }, "live.message.delete", { type: "LiveChatMessage", id: messageId }, {
    sessionId: message.sessionId,
    authorId: message.userId,
  });
  await publish(message.sessionId, { type: "chat-delete", id: messageId });
  return { ok: true };
});

// ── Réactions et main levée ──

export const sendReactionAction = createAction(z.object({ sessionId: id, reaction: z.enum(REACTION_KEYS) }), async ({ sessionId, reaction }) => {
  const { viewer } = await resolveRoom(sessionId, { mutation: true });
  if (!(await rateLimit("liveReaction", viewer.userId)).ok) return fail("tooManyAttempts");
  await publish(sessionId, { type: "reaction", userId: viewer.userId, name: viewer.name, reaction });
  return { ok: true };
});

export const setHandAction = createAction(z.object({ sessionId: id, raised: z.boolean() }), async ({ sessionId, raised }) => {
  const { viewer } = await resolveRoom(sessionId, { mutation: true });
  if (!(await rateLimit("liveHand", viewer.userId)).ok) return fail("tooManyAttempts");
  await db.liveRoomPresence.upsert({
    where: { sessionId_userId: { sessionId, userId: viewer.userId } },
    create: { sessionId, userId: viewer.userId, handRaisedAt: raised ? new Date() : null },
    update: raised ? { handRaisedAt: new Date(), lastSeenAt: new Date() } : { handRaisedAt: null, floorGrantedAt: null },
  });
  await publish(sessionId, { type: "roster" });
  return { ok: true };
});

/** L'enseignant donne la parole (baisse la main et prévient l'étudiant) ou baisse simplement la main. */
export const moderateHandAction = createAction(
  z.object({ sessionId: id, userId: id, decision: z.enum(["grant", "lower"]) }),
  async ({ sessionId, userId, decision }) => {
    await hostRoom(sessionId);
    const presence = await db.liveRoomPresence.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
      select: { user: { select: { name: true } } },
    });
    if (!presence) return fail("notFound");
    await db.liveRoomPresence.update({
      where: { sessionId_userId: { sessionId, userId } },
      data: { handRaisedAt: null, floorGrantedAt: decision === "grant" ? new Date() : null },
    });
    if (decision === "grant") await publish(sessionId, { type: "floor", userId, name: presence.user.name });
    await publish(sessionId, { type: "roster" });
    return { ok: true };
  },
);

// ── Gestion des séances (back-office) ──

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateInvalid");
const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "timeInvalid");

export const createLiveSessionAction = createAction(
  z.object({
    title: z.string().trim().min(3, "titleTooShort").max(120, "titleTooLong"),
    description: z.string().trim().max(1000, "descriptionTooLong").optional().or(z.literal("").transform(() => undefined)),
    levelId: id,
    date: dateField,
    time: timeField,
    durationMin: z.coerce.number().int().min(15, "durationInvalid").max(240, "durationInvalid"),
  }),
  async (input) => {
    const admin = await assertAdmin();
    const level = await db.level.findUnique({ where: { id: input.levelId }, select: { id: true } });
    if (!level) return fail("validation", { levelId: ["required"] });
    // Date et heure saisies dans le fuseau de l'administrateur, enregistrées en UTC.
    const [y, mo, d] = input.date.split("-").map(Number) as [number, number, number];
    const [h, mi] = input.time.split(":").map(Number) as [number, number];
    const startsAt = new Date(new TZDate(y, mo - 1, d, h, mi, admin.timezone).getTime());
    if (startsAt.getTime() < Date.now() - 5 * 60_000) return fail("validation", { date: ["dateInPast"] });
    const session = await db.liveSession.create({
      data: {
        title: input.title,
        description: input.description,
        levelId: level.id,
        startsAt,
        durationMin: input.durationMin,
        timezone: admin.timezone,
      },
      select: { id: true },
    });
    await audit({ actorId: admin.userId, ip: admin.ip, userAgent: admin.userAgent }, "live.session.create", { type: "LiveSession", id: session.id }, {
      title: input.title,
      startsAt: startsAt.toISOString(),
    });
    revalidatePath("/[locale]/admin/live", "page");
    return { ok: true };
  },
);

export const cancelLiveSessionAction = createAction(z.object({ sessionId: id }), async ({ sessionId }) => {
  const admin = await assertAdmin();
  const session = await db.liveSession.findUnique({ where: { id: sessionId }, select: { status: true } });
  if (!session || session.status !== "SCHEDULED") return fail("notFound");
  await db.liveSession.update({ where: { id: sessionId }, data: { status: "CANCELLED" } });
  await audit({ actorId: admin.userId, ip: admin.ip, userAgent: admin.userAgent }, "live.session.cancel", { type: "LiveSession", id: sessionId });
  await publish(sessionId, { type: "closed" });
  revalidatePath("/[locale]/admin/live", "page");
  return { ok: true };
});
