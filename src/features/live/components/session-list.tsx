"use client";

import { ArrowRight, CalendarClock, Clock, Users, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { LEVEL_THEME, type LevelCode } from "@/components/brand/levels";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { cancelLiveSessionAction } from "../actions";
import { roomPhase, roomTimes, type RoomTiming } from "../rules";
import { formatClock, useNow } from "./use-room";

export type SessionItem = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  durationMin: number;
  joinWindowMin: number;
  status: RoomTiming["status"];
  levelCode: string;
  present?: number;
};

/** Cartes de séances avec état en direct (à venir, salle ouverte, en cours) et accès à la salle. */
export function SessionList({ items, host = false, serverNow }: { items: SessionItem[]; host?: boolean; serverNow: number }) {
  const now = useNow(serverNow);
  return (
    <ul className="grid gap-4">
      {items.map((s) => (
        <SessionCard key={s.id} item={s} host={host} now={now} />
      ))}
    </ul>
  );
}

function SessionCard({ item: s, host, now }: { item: SessionItem; host: boolean; now: number }) {
  const t = useTranslations("live");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const timing = { startsAt: new Date(s.startsAt), durationMin: s.durationMin, joinWindowMin: s.joinWindowMin, status: s.status };
  const phase = roomPhase(timing, new Date(now));
  const times = roomTimes(timing);
  const theme = LEVEL_THEME[s.levelCode as LevelCode];
  const canJoin = phase === "open" || phase === "live" || (host && phase === "upcoming");

  const cancel = async () => {
    if (!window.confirm(t("cancelConfirm", { title: s.title }))) return;
    setCancelling(true);
    const res = await cancelLiveSessionAction(null, { sessionId: s.id });
    setCancelling(false);
    if (res.ok) {
      toast.success(t("cancelled"));
      router.refresh();
    } else toast.error(te(res.error));
  };

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6",
        phase === "live" && "border-red-500/40 ring-2 ring-red-500/20",
        (phase === "cancelled" || phase === "ended") && "opacity-60",
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className={cn("flex w-20 shrink-0 flex-col items-center justify-center rounded-xl py-2.5 text-white", theme?.bg ?? "bg-night")}>
          <span className="text-xs font-semibold tracking-widest uppercase opacity-90">{format.dateTime(timing.startsAt, { month: "short" })}</span>
          <span className="font-display text-3xl leading-none">{format.dateTime(timing.startsAt, { day: "numeric" })}</span>
          <span className="mt-1 text-xs opacity-90">{format.dateTime(timing.startsAt, { weekday: "short" })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <PhaseBadge phase={phase} />
            <span className="text-xs font-semibold text-muted-foreground">{s.levelCode}</span>
          </div>
          <h3 className="font-display text-xl">{s.title}</h3>
          {s.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden />
              {format.dateTime(timing.startsAt, { hour: "2-digit", minute: "2-digit" })} – {format.dateTime(times.endsAt, { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="size-4" aria-hidden />
              {phase === "upcoming" || phase === "open"
                ? t("startsIn", { time: formatClock(timing.startsAt.getTime() - now) })
                : phase === "live"
                  ? t("startedSince", { time: formatClock(now - timing.startsAt.getTime()) })
                  : t("duration", { minutes: s.durationMin })}
            </span>
            {host && s.present !== undefined && s.present > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" aria-hidden />
                {t("presentCount", { count: s.present })}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {host && s.status === "SCHEDULED" && phase !== "ended" && (
            <Button variant="ghost" size="icon" onClick={cancel} disabled={cancelling} aria-label={t("cancel")}>
              <X className="size-4" aria-hidden />
            </Button>
          )}
          {canJoin ? (
            <Button asChild size="lg" className={cn(phase === "live" ? "bg-red-600 text-white hover:bg-red-500" : "bg-brand text-white hover:bg-brand/90")}>
              <Link href={`/room/${s.id}`}>
                {phase === "live" ? t("joinLive") : host ? t("openRoom") : t("enter")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : (
            phase === "upcoming" && (
              <p className="text-right text-xs text-muted-foreground">
                {t("opensAt", { time: format.dateTime(times.opensAt, { hour: "2-digit", minute: "2-digit" }) })}
              </p>
            )
          )}
        </div>
      </div>
    </li>
  );
}

function PhaseBadge({ phase }: { phase: ReturnType<typeof roomPhase> }) {
  const t = useTranslations("live.phase");
  const styles = {
    upcoming: "bg-muted text-muted-foreground",
    open: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    live: "bg-red-600 text-white",
    ended: "bg-muted text-muted-foreground",
    cancelled: "bg-muted text-muted-foreground line-through",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", styles[phase])}>
      {phase === "live" && <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />}
      {t(phase)}
    </span>
  );
}
