import "server-only";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { env } from "@/env";
import { db } from "@/server/db";
import { assertAdmin, assertApprovedStudent, AuthorizationError } from "@/server/dal/guards";
import { getViewer, type Viewer } from "@/server/dal/viewer";
import {
  canEnterRoom,
  CHAT_HISTORY_LIMIT,
  liveRoomName,
  PRESENCE_TTL_SEC,
  sortRoster,
  type ChatMessage,
  type RoomRole,
  type RosterEntry,
} from "./rules";

const roomSessionSelect = {
  id: true,
  title: true,
  description: true,
  levelId: true,
  startsAt: true,
  durationMin: true,
  joinWindowMin: true,
  timezone: true,
  status: true,
  level: { select: { code: true, name: true } },
} as const;

/**
 * Point d'entrée UNIQUE du contrôle d'accès à une salle (pages, Server Actions, flux SSE) :
 * session valide, compte approuvé (ou administrateur avec 2FA), puis règles de la séance
 * (niveau, fenêtre d'ouverture). `mutation` refuse l'impersonation, qui reste en lecture seule.
 */
export async function resolveRoom(sessionId: string, opts: { mutation?: boolean } = {}) {
  const viewer = await getViewer();
  if (!viewer) throw new AuthorizationError("UNAUTHENTICATED");
  if (viewer.role === "ADMIN") await assertAdmin();
  else await assertApprovedStudent(opts);
  const session = await db.liveSession.findUnique({ where: { id: sessionId }, select: roomSessionSelect });
  if (!session) throw new AuthorizationError("FORBIDDEN");
  const decision = canEnterRoom({ role: viewer.role, levelId: viewer.levelId }, session);
  if (!decision.allow) throw new AuthorizationError("FORBIDDEN");
  return { viewer, session, role: decision.role };
}

export type RoomSession = Awaited<ReturnType<typeof resolveRoom>>["session"];

/** Pour les flux longs (SSE) : revérifie en base que la personne a toujours accès, sans en-têtes de requête. */
export async function stillAllowed(viewer: Viewer, sessionId: string): Promise<boolean> {
  const [user, authSession, session] = await Promise.all([
    db.user.findUnique({ where: { id: viewer.userId }, select: { role: true, status: true, currentLevelId: true, deletedAt: true } }),
    db.session.findUnique({ where: { id: viewer.sessionId }, select: { expiresAt: true } }),
    db.liveSession.findUnique({ where: { id: sessionId }, select: roomSessionSelect }),
  ]);
  if (!user || user.deletedAt || !authSession || authSession.expiresAt <= new Date() || !session) return false;
  if (user.role !== "ADMIN" && user.status !== "APPROVED") return false;
  return canEnterRoom({ role: user.role, levelId: user.currentLevelId }, session).allow;
}

// ── Présence ──

/** Marque la personne présente ; renvoie true si elle ne l'était pas (pour rafraîchir la liste). */
export async function touchPresence(sessionId: string, userId: string): Promise<boolean> {
  const before = await db.liveRoomPresence.findUnique({ where: { sessionId_userId: { sessionId, userId } }, select: { lastSeenAt: true } });
  const now = new Date();
  await db.liveRoomPresence.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    create: { sessionId, userId },
    update: { lastSeenAt: now },
  });
  return !before || now.getTime() - before.lastSeenAt.getTime() > PRESENCE_TTL_SEC * 1000;
}

export async function leavePresence(sessionId: string, userId: string) {
  await db.liveRoomPresence.updateMany({
    where: { sessionId, userId },
    data: { lastSeenAt: new Date(Date.now() - (PRESENCE_TTL_SEC + 1) * 1000), handRaisedAt: null },
  });
}

export async function getRoster(sessionId: string): Promise<RosterEntry[]> {
  const rows = await db.liveRoomPresence.findMany({
    where: { sessionId, lastSeenAt: { gt: new Date(Date.now() - PRESENCE_TTL_SEC * 1000) } },
    select: { userId: true, handRaisedAt: true, floorGrantedAt: true, user: { select: { name: true, role: true } } },
    take: 200,
  });
  return sortRoster(
    rows.map((r) => ({
      userId: r.userId,
      name: r.user.name,
      role: r.user.role === "ADMIN" ? "host" : "student",
      handRaisedAt: r.handRaisedAt?.toISOString() ?? null,
      floorGrantedAt: r.floorGrantedAt?.toISOString() ?? null,
    })),
  );
}

// ── Chat ──

export async function getChatHistory(sessionId: string, viewerId: string): Promise<ChatMessage[]> {
  const rows = await db.liveChatMessage.findMany({
    where: { sessionId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: CHAT_HISTORY_LIMIT,
    select: {
      id: true,
      userId: true,
      body: true,
      createdAt: true,
      user: { select: { name: true, role: true } },
      _count: { select: { likes: true } },
      likes: { where: { userId: viewerId }, select: { userId: true } },
    },
  });
  return rows.reverse().map((m) => ({
    id: m.id,
    userId: m.userId,
    author: m.user.name,
    authorRole: m.user.role === "ADMIN" ? "host" : "student",
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    likes: m._count.likes,
    likedByMe: m.likes.length > 0,
  }));
}

// ── Vidéo (LiveKit) ──

export const liveKitConfigured = () => Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);

export type VideoAccess = { mode: "livekit"; url: string; token: string } | { mode: "demo" };

/**
 * Jeton LiveKit valable 3 h pour CETTE salle uniquement. L'identité est l'identifiant de
 * l'utilisateur (relu en base) : impossible d'usurper quelqu'un d'autre. Seul l'enseignant peut
 * partager son écran et administrer la salle ; les données passent par notre propre canal.
 */
export async function createVideoAccess(viewer: Viewer, sessionId: string, role: RoomRole): Promise<VideoAccess> {
  if (!liveKitConfigured()) return { mode: "demo" };
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: viewer.userId,
    name: viewer.name,
    ttl: "3h",
    metadata: JSON.stringify({ role }),
  });
  token.addGrant({
    room: liveRoomName(sessionId),
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: false,
    roomAdmin: role === "host",
    canPublishSources:
      role === "host"
        ? [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
        : [TrackSource.CAMERA, TrackSource.MICROPHONE],
  });
  return { mode: "livekit", url: env.LIVEKIT_URL!, token: await token.toJwt() };
}

/** Heure du rendu serveur, transmise aux comptes à rebours pour une hydratation identique. */
export function serverNow(): number {
  return Date.now();
}

// ── Listes de séances ──

const listSelect = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  durationMin: true,
  joinWindowMin: true,
  status: true,
  level: { select: { code: true, name: true } },
} as const;

/** Séances du niveau actuel de l'étudiant : en cours et à venir. */
export async function listStudentSessions(levelId: string | null) {
  if (!levelId) return [];
  return db.liveSession.findMany({
    where: { levelId, status: { not: "CANCELLED" }, startsAt: { gte: new Date(Date.now() - 6 * 3600_000) } },
    orderBy: { startsAt: "asc" },
    take: 20,
    select: listSelect,
  });
}

export async function listAdminSessions() {
  return db.liveSession.findMany({
    where: { startsAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
    orderBy: { startsAt: "asc" },
    take: 50,
    select: {
      ...listSelect,
      _count: { select: { presences: { where: { lastSeenAt: { gt: new Date(Date.now() - PRESENCE_TTL_SEC * 1000) } } } } },
    },
  });
}
