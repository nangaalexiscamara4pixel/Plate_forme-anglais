/**
 * Sous-titres et chapitres : formats texte simples, analysés côté serveur.
 * Les repères (cues) sont stockés en JSON et regénérés en WebVTT à la demande.
 */

export type Cue = { start: number; end: number; text: string };
export type Chapter = { start: number; title: string };

const TIME = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

function toSeconds(m: RegExpMatchArray): number {
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]!.padEnd(3, "0")) / 1000;
}

/** Analyse un fichier WebVTT ou SRT collé par l'administrateur. Les balises sont retirées. */
export function parseSubtitles(input: string, maxCues = 2000): Cue[] {
  const cues: Cue[] = [];
  const blocks = input.replace(/\r/g, "").replace(/^﻿?WEBVTT[^\n]*\n/, "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    const timeIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeIdx === -1) continue;
    const [a, b] = lines[timeIdx]!.split("-->");
    const ma = a?.match(TIME);
    const mb = b?.match(TIME);
    if (!ma || !mb) continue;
    const text = lines
      .slice(timeIdx + 1)
      .join("\n")
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 500);
    if (!text) continue;
    const start = toSeconds(ma);
    const end = toSeconds(mb);
    if (end <= start) continue;
    cues.push({ start, end, text });
    if (cues.length >= maxCues) break;
  }
  return cues.sort((x, y) => x.start - y.start);
}

function vttTime(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/** WebVTT sûr : le texte est échappé (le format interprète < et &). */
export function toWebVtt(cues: Cue[]): string {
  const esc = (s: string) => s.replaceAll("-->", "→").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${esc(c.text)}`).join("\n\n")}\n`;
}

/** Chapitres saisis une ligne par chapitre : « 00:00 Introduction », « 1:05:30 Conclusion ». */
export function parseChapters(input: string): Chapter[] {
  const chapters: Chapter[] = [];
  for (const line of input.split(/\r?\n/)) {
    const m = line.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.{1,120})$/);
    if (!m) continue;
    chapters.push({ start: Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]), title: m[4]!.trim() });
  }
  return chapters.sort((a, b) => a.start - b.start).slice(0, 100);
}

export function formatClock(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function chaptersToText(chapters: Chapter[]): string {
  return chapters.map((c) => `${formatClock(c.start)} ${c.title}`).join("\n");
}

export function cuesToVttText(cues: Cue[]): string {
  return cues.length ? toWebVtt(cues) : "";
}
