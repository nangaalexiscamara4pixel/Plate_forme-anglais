"use client";

import { AnimatePresence, motion } from "motion/react";
import { REACTIONS, type ReactionKey } from "../rules";

export type FlyingReaction = { id: number; reaction: ReactionKey; name: string; x: number };

/** Réactions qui s'envolent du bas de la scène, avec le prénom de leur auteur. */
export function ReactionsLayer({ items }: { items: FlyingReaction[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {items.map((r) => (
          <motion.div
            key={r.id}
            initial={{ y: 0, opacity: 0, scale: 0.6 }}
            animate={{ y: "-62vh", opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1, 1], x: [0, 14, -10, 6] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3.2, ease: "easeOut" }}
            className="absolute bottom-4 flex flex-col items-center gap-1"
            style={{ left: `${r.x}%` }}
          >
            <span className="text-5xl drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]">{REACTIONS[r.reaction]}</span>
            <span className="max-w-28 truncate rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">{r.name}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
