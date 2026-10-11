"use client";

import { ArrowDown, GraduationCap, Hand, Heart, Loader2, Mic, Send, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteChatMessageAction, moderateHandAction, sendChatMessageAction, toggleLikeAction } from "../actions";
import { CHAT_MAX_LENGTH, type ChatMessage, type RoomRole, type RosterEntry } from "../rules";
import { avatarColor, initials } from "./use-room";

export type PanelTab = "chat" | "people";

export function SidePanel({
  tab,
  onTab,
  onClose,
  sessionId,
  meId,
  role,
  messages,
  roster,
}: {
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  onClose: () => void;
  sessionId: string;
  meId: string;
  role: RoomRole;
  messages: ChatMessage[];
  roster: RosterEntry[];
}) {
  const t = useTranslations("live.room");
  const hands = roster.filter((r) => r.handRaisedAt).length;
  return (
    <aside
      aria-label={t("panelLabel")}
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.21_0.055_264)]/95 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center gap-1 border-b border-white/10 p-2">
        <div role="tablist" className="flex flex-1 gap-1 rounded-xl bg-white/5 p-1">
          {(["chat", "people"] as const).map((key) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => onTab(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white/65 transition-colors hover:text-white",
                tab === key && "bg-white/12 text-white shadow-sm",
              )}
            >
              {key === "chat" ? t("chat") : t("participants")}
              {key === "people" && <span className="rounded-full bg-white/10 px-1.5 text-[11px] tabular-nums">{roster.length}</span>}
              {key === "people" && hands > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-night">
                  <Hand className="size-3" aria-hidden />
                  {hands}
                </span>
              )}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label={t("closePanel")} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {tab === "chat" ? (
        <ChatPanel sessionId={sessionId} meId={meId} role={role} messages={messages} />
      ) : (
        <PeoplePanel sessionId={sessionId} meId={meId} role={role} roster={roster} />
      )}
    </aside>
  );
}

// ── Chat ──

function ChatPanel({ sessionId, meId, role, messages }: { sessionId: string; meId: string; role: RoomRole; messages: ChatMessage[] }) {
  const t = useTranslations("live.room");
  const te = useTranslations("errors");
  const format = useFormatter();
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const lastCount = useRef(messages.length);

  // Défile automatiquement vers les nouveaux messages, sauf si l'on relit plus haut.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const added = messages.length - lastCount.current;
    lastCount.current = messages.length;
    const mine = messages.at(-1)?.userId === meId;
    if (atBottom || mine) el.scrollTop = el.scrollHeight;
    else if (added > 0) setUnseen((n) => n + added);
  }, [messages, atBottom, meId]);

  const onScroll = () => {
    const el = listRef.current!;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAtBottom(bottom);
    if (bottom) setUnseen(0);
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await sendChatMessageAction(null, { sessionId, body: text });
    setSending(false);
    if (res.ok) setBody("");
    else toast.error(te(res.error));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <>
      <div ref={listRef} onScroll={onScroll} className="relative flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white/55">
            <span className="text-4xl" aria-hidden>
              💬
            </span>
            <p className="font-medium text-white/80">{t("chatEmptyTitle")}</p>
            <p>{t("chatEmptyText")}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m, i) => {
              const grouped = i > 0 && messages[i - 1]!.userId === m.userId && Date.parse(m.createdAt) - Date.parse(messages[i - 1]!.createdAt) < 120_000;
              return (
                <motion.div key={m.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                  <ChatRow message={m} grouped={grouped} mine={m.userId === meId} canModerate={role === "host"} time={format.dateTime(new Date(m.createdAt), { hour: "2-digit", minute: "2-digit" })} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
      <AnimatePresence>
        {unseen > 0 && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })}
            className="mx-auto -mt-12 mb-2 flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
          >
            <ArrowDown className="size-3.5" aria-hidden />
            {t("newMessages", { count: unseen })}
          </motion.button>
        )}
      </AnimatePresence>
      <form onSubmit={submit} className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2 rounded-xl bg-white/7 p-1.5 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-brand-soft/60">
          <label htmlFor="room-chat" className="sr-only">
            {t("chatPlaceholder")}
          </label>
          <textarea
            id="room-chat"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={CHAT_MAX_LENGTH}
            rows={1}
            placeholder={t("chatPlaceholder")}
            className="field-sizing-content max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/40"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            aria-label={t("send")}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand/90 disabled:opacity-40"
          >
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          </button>
        </div>
        <p className="mt-1.5 flex justify-between px-1 text-[11px] text-white/40">
          <span>{t("chatHint")}</span>
          {body.length > CHAT_MAX_LENGTH - 80 && <span>{CHAT_MAX_LENGTH - body.length}</span>}
        </p>
      </form>
    </>
  );
}

function ChatRow({ message: m, grouped, mine, canModerate, time }: { message: ChatMessage; grouped: boolean; mine: boolean; canModerate: boolean; time: string }) {
  const t = useTranslations("live.room");
  const te = useTranslations("errors");
  const [burst, setBurst] = useState(0);
  const like = async () => {
    if (!m.likedByMe) setBurst((b) => b + 1);
    const res = await toggleLikeAction(null, { messageId: m.id });
    if (!res.ok) toast.error(te(res.error));
  };
  const remove = async () => {
    const res = await deleteChatMessageAction(null, { messageId: m.id });
    if (!res.ok) toast.error(te(res.error));
  };
  return (
    <div className={cn("group relative flex gap-2.5 rounded-xl px-2 py-1 hover:bg-white/5", !grouped && "mt-2")}>
      <div className="w-8 shrink-0">
        {!grouped && (
          <span className={cn("flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white", avatarColor(m.userId))} aria-hidden>
            {initials(m.author)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <p className="flex items-center gap-1.5 text-xs">
            <span className={cn("font-semibold", mine ? "text-brand-soft" : "text-white")}>{mine ? t("me") : m.author}</span>
            {m.authorRole === "host" && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/15 px-1 py-px text-[10px] font-semibold text-amber-300">
                <GraduationCap className="size-3" aria-hidden />
                {t("teacher")}
              </span>
            )}
            <time className="text-white/40">{time}</time>
          </p>
        )}
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-white/90">{m.body}</p>
        {m.likes > 0 && (
          <button
            type="button"
            onClick={like}
            aria-pressed={m.likedByMe}
            aria-label={t("likeCount", { count: m.likes })}
            className={cn(
              "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 transition",
              m.likedByMe ? "bg-brand/25 text-white ring-brand/50" : "bg-white/5 text-white/70 ring-white/10 hover:bg-white/10",
            )}
          >
            <Heart className={cn("size-3", m.likedByMe && "fill-brand-soft text-brand-soft")} aria-hidden />
            {m.likes}
          </button>
        )}
      </div>
      <div className="absolute top-0 right-1 flex -translate-y-1/3 gap-0.5 rounded-lg bg-[oklch(0.27_0.06_264)] p-0.5 opacity-0 shadow-lg ring-1 ring-white/10 transition group-focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" onClick={like} aria-label={m.likedByMe ? t("unlike") : t("like")} aria-pressed={m.likedByMe} className="relative rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
          <Heart className={cn("size-3.5", m.likedByMe && "fill-brand-soft text-brand-soft")} aria-hidden />
          <AnimatePresence>
            {burst > 0 && (
              <motion.span key={burst} initial={{ scale: 0.5, opacity: 1, y: 0 }} animate={{ scale: 1.8, opacity: 0, y: -14 }} transition={{ duration: 0.6 }} className="absolute inset-0 flex items-center justify-center text-brand-soft" aria-hidden>
                <Heart className="size-3.5 fill-current" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        {canModerate && (
          <button type="button" onClick={remove} aria-label={t("deleteMessage")} className="rounded-md p-1.5 text-white/70 hover:bg-red-500/20 hover:text-red-300">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Participants ──

function PeoplePanel({ sessionId, meId, role, roster }: { sessionId: string; meId: string; role: RoomRole; roster: RosterEntry[] }) {
  const t = useTranslations("live.room");
  const te = useTranslations("errors");
  const format = useFormatter();
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000); // « il y a 2 min »
    return () => clearInterval(id);
  }, []);
  const moderate = async (userId: string, decision: "grant" | "lower") => {
    const res = await moderateHandAction(null, { sessionId, userId, decision });
    if (!res.ok) toast.error(te(res.error));
  };
  return (
    <ul className="flex-1 space-y-1 overflow-y-auto p-3">
      {roster.map((p) => (
        <li key={p.userId} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-2.5 py-2", p.handRaisedAt ? "bg-amber-400/10 ring-1 ring-amber-400/30" : "hover:bg-white/5")}>
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white", avatarColor(p.userId))} aria-hidden>
            {initials(p.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
              {p.userId === meId ? t("you", { name: p.name }) : p.name}
              {p.role === "host" && <GraduationCap className="size-3.5 shrink-0 text-amber-300" aria-label={t("teacher")} />}
            </p>
            <p className="text-xs text-white/50">
              {p.handRaisedAt
                ? t("handRaisedAgo", { when: format.relativeTime(new Date(p.handRaisedAt), new Date()) })
                : p.floorGrantedAt
                  ? t("hasFloor")
                  : p.role === "host"
                    ? t("teacher")
                    : t("student")}
            </p>
          </div>
          {p.handRaisedAt && <Hand className="size-4 shrink-0 text-amber-300" aria-hidden />}
          {p.floorGrantedAt && !p.handRaisedAt && <Mic className="size-4 shrink-0 text-emerald-300" aria-hidden />}
          {role === "host" && p.handRaisedAt && (
            <div className="flex w-full gap-1.5 pl-12">
              <button type="button" onClick={() => moderate(p.userId, "grant")} className="flex-1 rounded-lg bg-emerald-500/90 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                {t("grantFloor")}
              </button>
              <button type="button" onClick={() => moderate(p.userId, "lower")} aria-label={t("lowerHandOf", { name: p.name })} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/15 hover:text-white">
                <X className="size-3.5" aria-hidden />
                {t("lowerHand")}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
