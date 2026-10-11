/**
 * Règles de la salle virtuelle — fonctions pures, partagées par le serveur (contrôle d'accès)
 * et l'interface (comptes à rebours, états), et testées unitairement.
 */

/** La salle reste ouverte 30 min après la fin prévue (questions, dépassement). */
export const ROOM_GRACE_AFTER_MIN = 30;
/** Pulsation de présence (secondes) et délai au-delà duquel une personne n'est plus « présente ». */
export const HEARTBEAT_SEC = 20;
export const PRESENCE_TTL_SEC = 45;
export const CHAT_MAX_LENGTH = 500;
export const CHAT_HISTORY_LIMIT = 100;

export const REACTIONS = {
  like: "👍",
  clap: "👏",
  heart: "❤️",
  laugh: "😂",
  party: "🎉",
  think: "🤔",
} as const;
export type ReactionKey = keyof typeof REACTIONS;
export const REACTION_KEYS = Object.keys(REACTIONS) as [ReactionKey, ...ReactionKey[]];

/** Nom de la salle vidéo LiveKit d'une séance. */
export const liveRoomName = (sessionId: string) => `gs-${sessionId}`;

export type RoomTiming = {
  startsAt: Date;
  durationMin: number;
  joinWindowMin: number;
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
};

/**
 * - upcoming : la salle n'est pas encore ouverte ;
 * - open : ouverte, avant l'heure de début (accueil, tests micro/caméra) ;
 * - live : la séance a commencé (jusqu'à la fin prévue + marge) ;
 * - ended / cancelled : fermée.
 */
export type RoomPhase = "upcoming" | "open" | "live" | "ended" | "cancelled";

export function roomTimes(s: Pick<RoomTiming, "startsAt" | "durationMin" | "joinWindowMin">) {
  const start = s.startsAt.getTime();
  return {
    opensAt: new Date(start - s.joinWindowMin * 60_000),
    startsAt: s.startsAt,
    endsAt: new Date(start + s.durationMin * 60_000),
    closesAt: new Date(start + (s.durationMin + ROOM_GRACE_AFTER_MIN) * 60_000),
  };
}

export function roomPhase(s: RoomTiming, now = new Date()): RoomPhase {
  if (s.status === "CANCELLED") return "cancelled";
  if (s.status === "COMPLETED") return "ended";
  const t = roomTimes(s);
  const n = now.getTime();
  if (n < t.opensAt.getTime()) return "upcoming";
  if (n < t.startsAt.getTime()) return "open";
  if (n < t.closesAt.getTime()) return "live";
  return "ended";
}

export type RoomRole = "host" | "student";
export type RoomDecision = { allow: true; role: RoomRole } | { allow: false; reason: "level" | "notOpen" | "closed" };

/**
 * Qui peut entrer :
 *  - l'administrateur (enseignant) : à tout moment tant que la séance n'est ni terminée ni annulée,
 *    pour préparer la salle ;
 *  - l'étudiant : uniquement les séances de SON niveau actuel, pendant la fenêtre d'ouverture.
 * Le statut du compte (approuvé, non suspendu) est vérifié en amont par les gardes du DAL.
 */
export function canEnterRoom(
  viewer: { role: "ADMIN" | "STUDENT"; levelId: string | null },
  session: RoomTiming & { levelId: string },
  now = new Date(),
): RoomDecision {
  const phase = roomPhase(session, now);
  if (phase === "ended" || phase === "cancelled") return { allow: false, reason: "closed" };
  if (viewer.role === "ADMIN") return { allow: true, role: "host" };
  if (!viewer.levelId || viewer.levelId !== session.levelId) return { allow: false, reason: "level" };
  if (phase === "upcoming") return { allow: false, reason: "notOpen" };
  return { allow: true, role: "student" };
}

// ── Messages échangés en temps réel (serveur → navigateur) ──

export type ChatMessage = {
  id: string;
  userId: string;
  author: string;
  authorRole: RoomRole;
  body: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
};

export type RosterEntry = {
  userId: string;
  name: string;
  role: RoomRole;
  handRaisedAt: string | null;
  floorGrantedAt: string | null;
};

/** Événements publiés sur le bus (Postgres NOTIFY) — sans donnée propre à un destinataire. */
export type BusEvent =
  | { type: "chat"; message: Omit<ChatMessage, "likedByMe"> }
  | { type: "chat-delete"; id: string }
  | { type: "like"; messageId: string; likes: number; userId: string; liked: boolean }
  | { type: "reaction"; userId: string; name: string; reaction: ReactionKey }
  | { type: "floor"; userId: string; name: string }
  | { type: "roster" }
  | { type: "closed" };

/** Événements reçus par le navigateur (le serveur remplace « roster » par la liste à jour). */
export type RoomEvent = Exclude<BusEvent, { type: "roster" }> | { type: "roster"; roster: RosterEntry[] };

/** Ordre d'affichage des participants : enseignant, mains levées (dans l'ordre), puis par nom. */
export function sortRoster(roster: RosterEntry[]): RosterEntry[] {
  return [...roster].sort((a, b) => {
    if (a.role !== b.role) return a.role === "host" ? -1 : 1;
    if (a.handRaisedAt && b.handRaisedAt) return a.handRaisedAt.localeCompare(b.handRaisedAt);
    if (a.handRaisedAt || b.handRaisedAt) return a.handRaisedAt ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
