"use client";

import { Hand, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, Smile, Users, Video, VideoOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { REACTION_KEYS, REACTIONS, type ReactionKey } from "../rules";
import { useMedia } from "./media";

/** Raccourcis clavier ignorés pendant la saisie (chat). */
function typing(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export function ControlDock({
  handRaised,
  onHand,
  onReact,
  panel,
  onPanel,
  unread,
  hands,
  onLeave,
}: {
  handRaised: boolean;
  onHand: () => void;
  onReact: (r: ReactionKey) => void;
  panel: "chat" | "people" | null;
  onPanel: (p: "chat" | "people") => void;
  unread: number;
  hands: number;
  onLeave: () => void;
}) {
  const t = useTranslations("live.room");
  const media = useMedia();
  const [talking, setTalking] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const ptt = useRef(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Le menu des réactions reste ouvert pour en envoyer plusieurs ; il se ferme en cliquant ailleurs.
  useEffect(() => {
    if (!emojiOpen) return;
    const close = (e: PointerEvent) => {
      if (!emojiRef.current?.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [emojiOpen]);

  // « Maintenir pour parler » : le micro s'ouvre tant que la touche Espace ou le bouton est maintenu.
  const startTalk = useCallback(() => {
    if (ptt.current || media.micOn) return;
    ptt.current = true;
    setTalking(true);
    void media.setMic(true);
  }, [media]);
  const stopTalk = useCallback(() => {
    if (!ptt.current) return;
    ptt.current = false;
    setTalking(false);
    void media.setMic(false);
  }, [media]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) startTalk();
        return;
      }
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "m") void media.setMic(!media.micOn);
      else if (key === "v") void media.setCam(!media.camOn);
      else if (key === "h") onHand();
      else if (key === "c") onPanel("chat");
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") stopTalk();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stopTalk);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stopTalk);
    };
  }, [media, onHand, onPanel, startTalk, stopTalk]);

  return (
    <div className="relative flex items-center justify-center gap-2 px-2 pb-3 sm:gap-3 sm:px-3 sm:pb-4">
      <AnimatePresence>
        {talking && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute -top-11 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg"
            role="status"
          >
            <span className="flex h-3 items-end gap-0.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="w-0.5 rounded-full bg-white" animate={{ height: ["30%", "100%", "30%"] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </span>
            {t("talking")}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex max-w-full items-center gap-1 rounded-2xl border border-white/10 bg-[oklch(0.22_0.055_264)]/90 p-1.5 shadow-2xl backdrop-blur-xl sm:gap-2 sm:p-2">
        <DockButton label={media.micOn ? t("micOff") : t("micOn")} shortcut="M" active={media.micOn} danger={!media.micOn} onClick={() => media.setMic(!media.micOn)}>
          {media.micOn ? <Mic className="size-5" aria-hidden /> : <MicOff className="size-5" aria-hidden />}
        </DockButton>
        {!media.micOn || talking ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  startTalk();
                }}
                onPointerUp={stopTalk}
                onPointerCancel={stopTalk}
                onKeyDown={(e) => (e.key === "Enter" ? startTalk() : undefined)}
                onKeyUp={(e) => (e.key === "Enter" ? stopTalk() : undefined)}
                aria-pressed={talking}
                className={cn(
                  "hidden h-12 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition select-none sm:flex",
                  talking ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]" : "bg-white/10 hover:bg-white/15",
                )}
              >
                <Mic className="size-4" aria-hidden />
                {t("pushToTalk")}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("pushToTalkHint")}</TooltipContent>
          </Tooltip>
        ) : null}
        <DockButton label={media.camOn ? t("camOff") : t("camOn")} shortcut="V" active={media.camOn} danger={!media.camOn} onClick={() => media.setCam(!media.camOn)}>
          {media.camOn ? <Video className="size-5" aria-hidden /> : <VideoOff className="size-5" aria-hidden />}
        </DockButton>
        {media.canScreenShare && (
          <DockButton label={media.screenOn ? t("screenOff") : t("screenOn")} active={media.screenOn} highlight={media.screenOn} onClick={() => media.setScreen(!media.screenOn)} className="max-sm:hidden">
            <MonitorUp className="size-5" aria-hidden />
          </DockButton>
        )}
        <span className="mx-0.5 h-8 w-px bg-white/10 max-sm:hidden" aria-hidden />
        <DockButton label={handRaised ? t("lowerHand") : t("raiseHand")} shortcut="H" active={handRaised} amber={handRaised} onClick={onHand}>
          <Hand className={cn("size-5", handRaised && "animate-[wave_1.2s_ease-in-out_infinite] origin-bottom")} aria-hidden />
        </DockButton>
        <div ref={emojiRef} className="relative">
          <DockButton label={t("react")} active={emojiOpen} onClick={() => setEmojiOpen((o) => !o)} expanded={emojiOpen}>
            <Smile className="size-5" aria-hidden />
          </DockButton>
          <AnimatePresence>
            {emojiOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 gap-1 rounded-2xl border border-white/10 bg-[oklch(0.25_0.06_264)] p-1.5 shadow-2xl"
                role="menu"
                onKeyDown={(e) => e.key === "Escape" && setEmojiOpen(false)}
              >
                {REACTION_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    onClick={() => onReact(key)}
                    aria-label={t(`reactions.${key}`)}
                    className="flex size-11 items-center justify-center rounded-xl text-2xl transition hover:scale-125 hover:bg-white/10 active:scale-95"
                  >
                    {REACTIONS[key]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="mx-0.5 h-8 w-px bg-white/10 max-sm:hidden" aria-hidden />
        <DockButton label={t("chat")} shortcut="C" active={panel === "chat"} onClick={() => onPanel("chat")} badge={unread}>
          <MessageSquare className="size-5" aria-hidden />
        </DockButton>
        <DockButton label={t("participants")} active={panel === "people"} onClick={() => onPanel("people")} badge={hands} badgeAmber>
          <Users className="size-5" aria-hidden />
        </DockButton>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={onLeave} className="flex h-11 items-center gap-2 rounded-xl bg-red-600 px-3 font-semibold text-white transition hover:bg-red-500 sm:ml-1 sm:h-12 sm:px-4">
              <PhoneOff className="size-5" aria-hidden />
              <span className="max-md:sr-only">{t("leave")}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("leave")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function DockButton({
  label,
  shortcut,
  active,
  danger,
  amber,
  highlight,
  badge,
  badgeAmber,
  expanded,
  className,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  danger?: boolean;
  amber?: boolean;
  highlight?: boolean;
  badge?: number;
  badgeAmber?: boolean;
  expanded?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={expanded === undefined ? active : undefined}
          aria-expanded={expanded}
          className={cn(
            "relative flex size-11 items-center justify-center rounded-xl text-white transition active:scale-95 sm:size-12",
            danger ? "bg-red-500/15 text-red-200 hover:bg-red-500/25" : active ? "bg-white/18 hover:bg-white/25" : "bg-white/8 hover:bg-white/15",
            amber && "bg-amber-400 text-night hover:bg-amber-300",
            highlight && "bg-emerald-500 hover:bg-emerald-400",
            className,
          )}
        >
          {children}
          {!!badge && badge > 0 && (
            <span className={cn("absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold", badgeAmber ? "bg-amber-400 text-night" : "bg-brand text-white")}>
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <kbd className="ml-2 rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px]">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
