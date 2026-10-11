"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { RoomEvent } from "../rules";

export type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

/**
 * Abonnement au flux temps réel de la salle (Server-Sent Events). Le navigateur se reconnecte
 * tout seul après une coupure ; on expose l'état pour l'afficher. `closed` arrête tout.
 */
export function useRoomEvents(sessionId: string, enabled: boolean, onEvent: (event: RoomEvent) => void): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource(`/api/live/${encodeURIComponent(sessionId)}/events`);
    source.onopen = () => setStatus("open");
    source.onerror = () => setStatus(source.readyState === EventSource.CLOSED ? "closed" : "reconnecting");
    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as RoomEvent;
        if (event.type === "closed") {
          source.close();
          setStatus("closed");
        }
        handler.current(event);
      } catch {
        // message illisible : ignoré
      }
    };
    return () => source.close();
  }, [sessionId, enabled]);

  return enabled ? status : "connecting";
}

// Horloge partagée (un seul minuteur pour toute la page).
const tickers = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;
function subscribeClock(onTick: () => void) {
  tickers.add(onTick);
  ticker ??= setInterval(() => tickers.forEach((f) => f()), 1000);
  return () => {
    tickers.delete(onTick);
    if (tickers.size === 0 && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}
const clockSnapshot = () => Math.floor(Date.now() / 1000) * 1000;

/**
 * Heure courante pour les comptes à rebours, rafraîchie chaque seconde. `serverNow` (l'heure du
 * rendu serveur) est utilisée pendant l'hydratation : le texte affiché est identique des deux côtés.
 */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(subscribeClock, clockSnapshot, () => serverNow);
}

/** « 01:05:09 » ou « 05:09 ». */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Mise en page de la mosaïque vidéo : choisit le nombre de colonnes qui donne les plus grandes
 * vignettes 16/9 possibles dans l'espace disponible.
 */
export function useGridLayout(ref: RefObject<HTMLElement | null>, count: number, gap = 12) {
  const [layout, setLayout] = useState({ cols: 1, tileWidth: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => {
      const { width, height } = el.getBoundingClientRect();
      const n = Math.max(1, count);
      let best = { cols: 1, tileWidth: 0 };
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const byWidth = (width - gap * (cols - 1)) / cols;
        const byHeight = ((height - gap * (rows - 1)) / rows) * (16 / 9);
        const tileWidth = Math.floor(Math.min(byWidth, byHeight));
        if (tileWidth > best.tileWidth) best = { cols, tileWidth };
      }
      setLayout(best);
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, count, gap]);
  return layout;
}

/** Couleur d'avatar stable par personne (teintes de la marque et des niveaux). */
const AVATAR_COLORS = ["bg-[oklch(0.55_0.17_264)]", "bg-[oklch(0.55_0.19_25)]", "bg-[oklch(0.55_0.13_155)]", "bg-[oklch(0.55_0.15_290)]", "bg-[oklch(0.6_0.13_230)]", "bg-[oklch(0.62_0.14_70)]"];
export function avatarColor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
