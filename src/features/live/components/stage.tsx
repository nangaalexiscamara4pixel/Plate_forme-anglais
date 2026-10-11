"use client";

import { GraduationCap, Hand, MicOff, MonitorUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { RosterEntry } from "../rules";
import { useMedia, type Tile } from "./media";
import { avatarColor, initials, useGridLayout } from "./use-room";

/**
 * Scène vidéo : mosaïque adaptative (vignettes 16/9 aussi grandes que possible) ; un partage
 * d'écran prend la place principale, les participants passent dans une colonne latérale.
 */
export function Stage({ roster, meId }: { roster: RosterEntry[]; meId: string }) {
  const { tiles } = useMedia();
  const byUser = new Map(roster.map((r) => [r.userId, r]));
  const screen = tiles.find((t) => t.isScreen);
  const people = tiles
    .filter((t) => !t.isScreen)
    .sort((a, b) => {
      const ra = byUser.get(a.userId)?.role === "host" ? 0 : 1;
      const rb = byUser.get(b.userId)?.role === "host" ? 0 : 1;
      return ra - rb || Number(b.isLocal) - Number(a.isLocal);
    });

  if (screen) {
    return (
      <div className="flex size-full flex-col gap-3 p-3 lg:flex-row">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
          {screen.video}
          <TileLabel tile={screen} entry={byUser.get(screen.userId)} meId={meId} screen />
        </div>
        <div className="flex shrink-0 gap-3 overflow-auto lg:w-64 lg:flex-col">
          {people.map((t) => (
            <div key={t.id} className="aspect-video w-48 shrink-0 lg:w-full">
              <VideoTile tile={t} entry={byUser.get(t.userId)} meId={meId} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <Mosaic tiles={people} byUser={byUser} meId={meId} />;
}

function Mosaic({ tiles, byUser, meId }: { tiles: Tile[]; byUser: Map<string, RosterEntry>; meId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { cols, tileWidth } = useGridLayout(ref, tiles.length);
  return (
    <div ref={ref} className="flex size-full items-center justify-center p-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, ${tileWidth}px)` }}>
        <AnimatePresence initial={false}>
          {tiles.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.25 }}
              className="aspect-video"
              style={{ width: tileWidth }}
            >
              <VideoTile tile={t} entry={byUser.get(t.userId)} meId={meId} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function VideoTile({ tile, entry, meId }: { tile: Tile; entry?: RosterEntry; meId: string }) {
  const hand = Boolean(entry?.handRaisedAt);
  return (
    <div
      className={cn(
        "relative size-full overflow-hidden rounded-2xl bg-[oklch(0.24_0.06_264)] ring-1 ring-white/10 transition-shadow duration-200",
        tile.speaking && "ring-[3px] ring-[oklch(0.72_0.15_155)] shadow-[0_0_0_6px_oklch(0.72_0.15_155/0.18)]",
        hand && !tile.speaking && "ring-2 ring-amber-400",
      )}
    >
      {tile.video ?? (
        <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,oklch(0.3_0.08_264),oklch(0.2_0.05_264))]">
          <span
            className={cn(
              "flex aspect-square w-[22%] max-w-24 min-w-12 items-center justify-center rounded-full font-display text-[clamp(1rem,3vw,2rem)] text-white shadow-lg",
              avatarColor(tile.userId),
              tile.speaking && "animate-pulse",
            )}
            aria-hidden
          >
            {initials(tile.name)}
          </span>
        </div>
      )}
      <AnimatePresence>
        {hand && (
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-amber-400 text-night shadow-lg"
          >
            <Hand className="size-5" aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
      <TileLabel tile={tile} entry={entry} meId={meId} />
    </div>
  );
}

function TileLabel({ tile, entry, meId, screen = false }: { tile: Tile; entry?: RosterEntry; meId: string; screen?: boolean }) {
  const t = useTranslations("live.room");
  const host = entry?.role === "host";
  return (
    <div className="absolute bottom-2.5 left-2.5 flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
      {screen ? <MonitorUp className="size-3.5 shrink-0" aria-hidden /> : !tile.micOn && <MicOff className="size-3.5 shrink-0 text-red-300" aria-label={t("micMuted")} />}
      {host && !screen && <GraduationCap className="size-3.5 shrink-0 text-amber-300" aria-label={t("teacher")} />}
      <span className="truncate">
        {screen ? t("screenOf", { name: tile.name }) : tile.userId === meId ? t("you", { name: tile.name }) : tile.name}
      </span>
    </div>
  );
}
