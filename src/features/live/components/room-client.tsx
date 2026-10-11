"use client";

import { Hand, Loader2, Radio, Users, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GlobeMark } from "@/components/brand/logo";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { joinVideoAction, moderateHandAction, sendReactionAction, setHandAction } from "../actions";
import type { ChatMessage, ReactionKey, RoomEvent, RoomRole, RosterEntry } from "../rules";
import { ControlDock } from "./control-dock";
import { Lobby } from "./lobby";
import { DemoMedia, LiveKitMedia, useMedia, type Media, type MediaPrefs } from "./media";
import { ReactionsLayer, type FlyingReaction } from "./reactions";
import { SidePanel, type PanelTab } from "./side-panel";
import { Stage } from "./stage";
import { formatClock, useNow, useRoomEvents, type StreamStatus } from "./use-room";

export type RoomInfo = {
  sessionId: string;
  title: string;
  levelCode: string;
  startsAt: string;
  endsAt: string;
  role: RoomRole;
  me: { userId: string; name: string };
  backHref: string;
  /** Heure du rendu serveur (hydratation des comptes à rebours). */
  serverNow: number;
};

type VideoAccess = { mode: "livekit"; url: string; token: string } | { mode: "demo" };

/**
 * Salle virtuelle : hall d'accueil, puis scène vidéo, chat, participants, réactions et mains
 * levées, synchronisés en temps réel. L'état partagé (chat, présence) vient du serveur ; la vidéo
 * passe par LiveKit (ou le mode démo).
 */
export function RoomClient({ info, initialMessages, initialRoster, liveKit }: { info: RoomInfo; initialMessages: ChatMessage[]; initialRoster: RosterEntry[]; liveKit: boolean }) {
  const t = useTranslations("live.room");
  const te = useTranslations("errors");
  const router = useRouter();
  const [step, setStep] = useState<"lobby" | "joining" | "room" | "closed">("lobby");
  const [access, setAccess] = useState<VideoAccess | null>(null);
  const [prefs, setPrefs] = useState<MediaPrefs>({ mic: false, cam: false });
  const [messages, setMessages] = useState(initialMessages);
  const [roster, setRoster] = useState(initialRoster);
  const [reactions, setReactions] = useState<FlyingReaction[]>([]);
  // Panneau de discussion ouvert d'office sur grand écran (la salle n'est jamais rendue côté serveur).
  const [panel, setPanel] = useState<PanelTab | null>(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches ? "chat" : null,
  );
  const [unread, setUnread] = useState(0);
  const mediaRef = useRef<Media | null>(null);
  const panelRef = useRef(panel);
  const rosterRef = useRef(roster);
  const reactionId = useRef(0);
  useEffect(() => {
    panelRef.current = panel;
    rosterRef.current = roster;
  });

  const isHost = info.role === "host";
  const me = info.me.userId;

  const onEvent = useCallback(
    (event: RoomEvent) => {
      switch (event.type) {
        case "chat":
          setMessages((list) => (list.some((m) => m.id === event.message.id) ? list : [...list, { ...event.message, likedByMe: false }].slice(-300)));
          if (panelRef.current !== "chat" && event.message.userId !== me) setUnread((n) => n + 1);
          break;
        case "chat-delete":
          setMessages((list) => list.filter((m) => m.id !== event.id));
          break;
        case "like":
          setMessages((list) => list.map((m) => (m.id === event.messageId ? { ...m, likes: event.likes, likedByMe: event.userId === me ? event.liked : m.likedByMe } : m)));
          break;
        case "reaction": {
          const id = ++reactionId.current;
          setReactions((list) => [...list.slice(-24), { id, reaction: event.reaction, name: event.userId === me ? t("me") : event.name.split(" ")[0]!, x: 8 + Math.random() * 80 }]);
          setTimeout(() => setReactions((list) => list.filter((r) => r.id !== id)), 3400);
          break;
        }
        case "roster": {
          if (isHost) {
            const before = new Set(rosterRef.current.filter((r) => r.handRaisedAt).map((r) => r.userId));
            for (const r of event.roster) {
              if (r.handRaisedAt && !before.has(r.userId) && r.userId !== me) {
                toast(t("handRaisedToast", { name: r.name }), {
                  icon: <Hand className="size-4 text-amber-500" />,
                  action: { label: t("grantFloor"), onClick: () => void moderateHandAction(null, { sessionId: info.sessionId, userId: r.userId, decision: "grant" }) },
                });
              }
            }
          }
          setRoster(event.roster);
          break;
        }
        case "floor":
          if (event.userId === me) {
            toast.success(t("floorGrantedToast"), {
              duration: 10_000,
              action: { label: t("micOn"), onClick: () => void mediaRef.current?.setMic(true) },
            });
          }
          break;
        case "closed":
          setStep("closed");
          break;
      }
    },
    [isHost, me, t, info.sessionId],
  );

  const stream = useRoomEvents(info.sessionId, step === "room", onEvent);

  const join = async (chosen: MediaPrefs) => {
    setPrefs(chosen);
    setStep("joining");
    const res = await joinVideoAction(null, { sessionId: info.sessionId });
    if (!res.ok || !res.data) {
      toast.error(te(res.ok ? "generic" : res.error));
      return setStep("lobby");
    }
    setAccess(res.data);
    setStep("room");
  };

  const myHand = Boolean(roster.find((r) => r.userId === me)?.handRaisedAt);
  const toggleHand = useCallback(async () => {
    const raised = !rosterRef.current.find((r) => r.userId === me)?.handRaisedAt;
    // Affichage immédiat, confirmé par le serveur via la liste des présents.
    setRoster((list) => list.map((r) => (r.userId === me ? { ...r, handRaisedAt: raised ? new Date().toISOString() : null } : r)));
    const res = await setHandAction(null, { sessionId: info.sessionId, raised });
    if (!res.ok) toast.error(te(res.error));
  }, [me, info.sessionId, te]);

  const react = useCallback(
    async (reaction: ReactionKey) => {
      const res = await sendReactionAction(null, { sessionId: info.sessionId, reaction });
      if (!res.ok) toast.error(te(res.error));
    },
    [info.sessionId, te],
  );

  const openPanel = useCallback((p: PanelTab) => {
    setPanel((current) => (current === p ? null : p));
    if (p === "chat") setUnread(0);
  }, []);

  const leave = useCallback(() => router.push(info.backHref), [router, info.backHref]);

  if (step === "closed") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="text-5xl" aria-hidden>
            👋
          </span>
          <h1 className="font-display text-3xl text-white">{t("closedTitle")}</h1>
          <p className="max-w-md text-white/60">{t("closedText")}</p>
          <Link href={info.backHref} className="mt-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand/90">
            {t("back")}
          </Link>
        </div>
      </Shell>
    );
  }

  if (step !== "room" || !access) {
    return (
      <Shell>
        <TopBar info={info} count={null} stream={null} />
        <Lobby me={info.me} title={info.title} levelCode={info.levelCode} startsAt={info.startsAt} endsAt={info.endsAt} isHost={isHost} demo={!liveKit} joining={step === "joining"} serverNow={info.serverNow} onJoin={join} />
      </Shell>
    );
  }

  const shell = (
    <RoomShell
      info={info}
      roster={roster}
      messages={messages}
      reactions={reactions}
      panel={panel}
      setPanel={setPanel}
      openPanel={openPanel}
      unread={unread}
      myHand={myHand}
      onHand={toggleHand}
      onReact={react}
      onLeave={leave}
      stream={stream}
      mediaRef={mediaRef}
    />
  );

  return (
    <Shell>
      {access.mode === "livekit" ? (
        <LiveKitMedia url={access.url} token={access.token} prefs={prefs} canScreenShare={isHost} onDisconnected={() => undefined}>
          {shell}
        </LiveKitMedia>
      ) : (
        <DemoMedia me={info.me} roster={roster} prefs={prefs} canScreenShare={isHost}>
          {shell}
        </DemoMedia>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark fixed inset-0 flex flex-col overflow-hidden bg-[oklch(0.16_0.045_264)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_0%,oklch(0.35_0.12_264/0.55),transparent),radial-gradient(40%_40%_at_100%_100%,oklch(0.45_0.17_25/0.18),transparent)]" aria-hidden />
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function RoomShell({
  info,
  roster,
  messages,
  reactions,
  panel,
  setPanel,
  openPanel,
  unread,
  myHand,
  onHand,
  onReact,
  onLeave,
  stream,
  mediaRef,
}: {
  info: RoomInfo;
  roster: RosterEntry[];
  messages: ChatMessage[];
  reactions: FlyingReaction[];
  panel: PanelTab | null;
  setPanel: (p: PanelTab | null) => void;
  openPanel: (p: PanelTab) => void;
  unread: number;
  myHand: boolean;
  onHand: () => void;
  onReact: (r: ReactionKey) => void;
  onLeave: () => void;
  stream: StreamStatus;
  mediaRef: React.RefObject<Media | null>;
}) {
  const t = useTranslations("live.room");
  const media = useMedia();
  useEffect(() => {
    mediaRef.current = media;
  });
  const hands = roster.filter((r) => r.handRaisedAt).length;

  return (
    <>
      <TopBar info={info} count={roster.length} stream={stream} media={media} />
      <div className="flex min-h-0 flex-1 gap-3 px-3">
        <main id="main" className="relative min-w-0 flex-1 overflow-hidden rounded-2xl">
          <Stage roster={roster} meId={info.me.userId} />
          <ReactionsLayer items={reactions} />
          {media.deviceError && (
            <p role="alert" className="absolute top-3 left-1/2 -translate-x-1/2 rounded-xl bg-red-500/90 px-4 py-2 text-sm text-white shadow-lg">
              {t(media.deviceError)}
            </p>
          )}
        </main>
        <AnimatePresence initial={false}>
          {panel && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.22 }}
              className="max-lg:fixed max-lg:inset-x-2 max-lg:top-16 max-lg:bottom-24 max-lg:z-40 lg:w-[22rem] lg:shrink-0"
            >
              <SidePanel tab={panel} onTab={openPanel} onClose={() => setPanel(null)} sessionId={info.sessionId} meId={info.me.userId} role={info.role} messages={messages} roster={roster} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="pt-3">
        <ControlDock handRaised={myHand} onHand={onHand} onReact={onReact} panel={panel} onPanel={openPanel} unread={unread} hands={info.role === "host" ? hands : 0} onLeave={onLeave} />
      </div>
    </>
  );
}

function TopBar({ info, count, stream, media }: { info: RoomInfo; count: number | null; stream: StreamStatus | null; media?: Media }) {
  const t = useTranslations("live.room");
  const now = useNow(info.serverNow);
  const start = Date.parse(info.startsAt);
  const started = now >= start;
  const offline = stream === "reconnecting" || media?.connection === "reconnecting" || media?.connection === "disconnected";
  const connecting = media?.connection === "connecting";
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 px-4">
      <Link href={info.backHref} className="flex items-center gap-2 rounded-lg" aria-label={t("back")}>
        <GlobeMark className="size-8 text-white" />
        <span className="hidden text-xs leading-tight font-semibold tracking-[0.2em] text-white/60 uppercase sm:block">
          GlobeSpeak
          <br />
          <span className="text-brand-soft">{t("virtualRoom")}</span>
        </span>
      </Link>
      <span className="mx-1 hidden h-8 w-px bg-white/10 sm:block" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{info.title}</p>
        <p className="text-xs text-white/50">{t("levelLabel", { level: info.levelCode })}</p>
      </div>
      {offline && (
        <span className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-200" role="status">
          <WifiOff className="size-3.5" aria-hidden />
          {t("reconnecting")}
        </span>
      )}
      {connecting && (
        <span className="flex items-center gap-1.5 text-xs text-white/60" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t("connecting")}
        </span>
      )}
      <span
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tabular-nums",
          started ? "bg-red-600 text-white shadow-[0_0_20px_-4px] shadow-red-500" : "bg-white/10 text-white/80",
        )}
      >
        {started ? <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden /> : <Radio className="size-3.5" aria-hidden />}
        {started ? `${t("live")} · ${formatClock(now - start)}` : t("startsIn", { time: formatClock(start - now) })}
      </span>
      {count !== null && (
        <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 sm:flex" aria-label={t("people", { count })}>
          <Users className="size-3.5" aria-hidden />
          {count}
        </span>
      )}
    </header>
  );
}
