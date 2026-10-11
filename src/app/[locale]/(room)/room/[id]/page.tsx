import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RoomClient } from "@/features/live/components/room-client";
import { RoomUnavailable } from "@/features/live/components/room-unavailable";
import { canEnterRoom, roomTimes } from "@/features/live/rules";
import { getChatHistory, getRoster, liveKitConfigured, serverNow } from "@/features/live/server";
import { redirect } from "@/i18n/navigation";
import { db } from "@/server/db";
import { requireAdmin, requireApprovedStudent } from "@/server/dal/guards";
import { getViewer } from "@/server/dal/viewer";


export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "live.room" });
  return { title: t("virtualRoom"), robots: { index: false, follow: false } };
}

/**
 * Salle virtuelle d'une séance. Mêmes gardes que les espaces privés ; un étudiant ne voit que
 * les séances de son niveau (sinon 404, sans révéler leur existence).
 */
export default async function RoomPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await getViewer();
  if (!viewer) redirect({ href: `/sign-in?next=${encodeURIComponent(`/room/${id}`)}`, locale });
  if (viewer!.role === "ADMIN") await requireAdmin();
  else await requireApprovedStudent();
  const me = viewer!;

  if (!/^[\w-]{1,64}$/.test(id)) notFound();
  const session = await db.liveSession.findUnique({
    where: { id },
    select: { id: true, title: true, levelId: true, startsAt: true, durationMin: true, joinWindowMin: true, status: true, level: { select: { code: true } } },
  });
  if (!session) notFound();

  const backHref = me.role === "ADMIN" ? "/admin/live" : "/app/live";
  const decision = canEnterRoom({ role: me.role, levelId: me.levelId }, session);
  const times = roomTimes(session);
  if (!decision.allow || me.impersonatedBy) {
    if (!decision.allow && decision.reason === "level") notFound();
    const reason = me.impersonatedBy ? "readOnly" : !decision.allow && decision.reason === "notOpen" ? "notOpen" : "closed";
    return (
      <RoomUnavailable
        reason={reason}
        title={session.title}
        opensAt={times.opensAt.toISOString()}
        backHref={backHref}
        serverNow={serverNow()}
      />
    );
  }

  const [messages, roster] = await Promise.all([getChatHistory(id, me.userId), getRoster(id)]);
  return (
    <RoomClient
      info={{
        sessionId: id,
        title: session.title,
        levelCode: session.level.code,
        startsAt: session.startsAt.toISOString(),
        endsAt: times.endsAt.toISOString(),
        role: decision.role,
        me: { userId: me.userId, name: me.name },
        backHref,
        serverNow: serverNow(),
      }}
      initialMessages={messages}
      initialRoster={roster}
      liveKit={liveKitConfigured()}
    />
  );
}
