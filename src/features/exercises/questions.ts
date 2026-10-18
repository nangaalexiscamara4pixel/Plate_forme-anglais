import { z } from "zod";

/**
 * Questions d'exercice — logique pure, partagée et testée :
 *  - saisie par l'enseignant (`QuestionInput`) → stockage (`payload` public + `answerKey` secret) ;
 *  - version publique servie à l'étudiant (jamais la clé de correction ; ordres mélangés) ;
 *  - correction automatique d'une réponse ;
 *  - affichage de la bonne réponse APRÈS envoi.
 */

export const QUESTION_TYPES = ["MCQ", "LISTENING_MCQ", "MULTI_SELECT", "TRUE_FALSE", "GAP_FILL", "SHORT_ANSWER", "ORDERING", "MATCHING"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

const text = (max: number) => z.string().trim().min(1, "required").max(max, "tooLong");
const options = z.array(text(300)).min(2, "optionsMin").max(8, "optionsMax");
const common = {
  prompt: text(1000),
  explanation: z.string().trim().max(1000, "tooLong").optional().or(z.literal("").transform(() => undefined)),
  points: z.coerce.number().int().min(1).max(20).default(1),
  /** Image ou document joint à l'énoncé (médiathèque). */
  // Chaîne vide (aucun fichier) ⇒ absent : jamais de référence vide en base.
  attachmentFileId: z
    .string()
    .max(64)
    .transform((v) => v || undefined)
    .optional(),
};

/** Blancs d'un texte à trous : `{réponse}` ou `{réponse|variante}`. */
const GAP = /\{([^{}]+)\}/g;

export const questionInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("MCQ"), ...common, options, correct: z.number().int().min(0) }),
  z.object({ type: z.literal("LISTENING_MCQ"), ...common, options, correct: z.number().int().min(0), audioFileId: z.string().min(1, "audioRequired").max(64) }),
  z.object({ type: z.literal("MULTI_SELECT"), ...common, options, correct: z.array(z.number().int().min(0)).min(1, "correctRequired") }),
  z.object({ type: z.literal("TRUE_FALSE"), ...common, correct: z.boolean() }),
  z.object({
    type: z.literal("GAP_FILL"),
    ...common,
    text: text(2000).refine((t) => [...t.matchAll(GAP)].length >= 1, "gapRequired").refine((t) => [...t.matchAll(GAP)].length <= 20, "tooManyGaps"),
  }),
  z.object({ type: z.literal("SHORT_ANSWER"), ...common, accepted: z.array(text(200)).min(1, "correctRequired").max(10) }),
  z.object({ type: z.literal("ORDERING"), ...common, items: z.array(text(200)).min(2, "optionsMin").max(10, "optionsMax") }),
  z.object({
    type: z.literal("MATCHING"),
    ...common,
    pairs: z.array(z.object({ left: text(200), right: text(200) })).min(2, "optionsMin").max(10, "optionsMax"),
  }),
]).superRefine((q, ctx) => {
  if ((q.type === "MCQ" || q.type === "LISTENING_MCQ") && q.correct >= q.options.length) ctx.addIssue({ code: "custom", path: ["correct"], message: "correctRequired" });
  if (q.type === "MULTI_SELECT" && q.correct.some((i) => i >= q.options.length)) ctx.addIssue({ code: "custom", path: ["correct"], message: "correctRequired" });
  if (q.type === "MATCHING" && new Set(q.pairs.map((p) => p.right.toLowerCase())).size !== q.pairs.length) {
    ctx.addIssue({ code: "custom", path: ["pairs"], message: "duplicateRight" });
  }
});
export type QuestionInput = z.infer<typeof questionInputSchema>;

/** Texte à trous → segments de texte et réponses acceptées pour chaque blanc. */
export function parseGapText(source: string): { segments: string[]; answers: string[][] } {
  const segments: string[] = [];
  const answers: string[][] = [];
  let last = 0;
  for (const m of source.matchAll(GAP)) {
    segments.push(source.slice(last, m.index));
    answers.push(m[1]!.split("|").map((a) => a.trim()).filter(Boolean));
    last = m.index! + m[0].length;
  }
  segments.push(source.slice(last));
  return { segments, answers };
}

export type StoredQuestion = {
  type: QuestionType;
  prompt: string;
  payload: unknown;
  answerKey: unknown;
  explanation: string | null;
  points: number;
  audioFileId: string | null;
  attachmentFileId: string | null;
};

/** Saisie de l'enseignant → données publiques + clé de correction. */
export function toStored(q: QuestionInput): StoredQuestion {
  const base = { type: q.type, prompt: q.prompt, explanation: q.explanation ?? null, points: q.points, audioFileId: null as string | null, attachmentFileId: q.attachmentFileId ?? null };
  switch (q.type) {
    case "MCQ":
      return { ...base, payload: { options: q.options }, answerKey: { correct: q.correct } };
    case "LISTENING_MCQ":
      return { ...base, audioFileId: q.audioFileId, payload: { options: q.options }, answerKey: { correct: q.correct } };
    case "MULTI_SELECT":
      return { ...base, payload: { options: q.options }, answerKey: { correct: [...new Set(q.correct)].sort((a, b) => a - b) } };
    case "TRUE_FALSE":
      return { ...base, payload: {}, answerKey: { correct: q.correct } };
    case "GAP_FILL": {
      const { segments, answers } = parseGapText(q.text);
      return { ...base, payload: { segments }, answerKey: { answers, source: q.text } };
    }
    case "SHORT_ANSWER":
      return { ...base, payload: {}, answerKey: { accepted: q.accepted } };
    case "ORDERING":
      return { ...base, payload: { items: q.items }, answerKey: { order: q.items } };
    case "MATCHING":
      return { ...base, payload: { left: q.pairs.map((p) => p.left), right: q.pairs.map((p) => p.right) }, answerKey: { right: q.pairs.map((p) => p.right) } };
  }
}

type Any = Record<string, unknown>;
const arr = (v: unknown) => (Array.isArray(v) ? v : []) as unknown[];
const strs = (v: unknown) => arr(v).map(String);

/** Question enregistrée → formulaire de l'enseignant (modification). */
export function toInput(q: {
  type: QuestionType;
  prompt: string;
  payload: unknown;
  answerKey: unknown;
  explanation: string | null;
  points: number;
  audioFileId: string | null;
  attachmentFileId?: string | null;
}): QuestionInput {
  const p = (q.payload ?? {}) as Any;
  const k = (q.answerKey ?? {}) as Any;
  const common = { prompt: q.prompt, explanation: q.explanation ?? undefined, points: q.points, attachmentFileId: q.attachmentFileId ?? undefined };
  switch (q.type) {
    case "MCQ":
      return { type: "MCQ", ...common, options: strs(p.options), correct: Number(k.correct ?? 0) };
    case "LISTENING_MCQ":
      return { type: "LISTENING_MCQ", ...common, options: strs(p.options), correct: Number(k.correct ?? 0), audioFileId: q.audioFileId ?? "" };
    case "MULTI_SELECT":
      return { type: "MULTI_SELECT", ...common, options: strs(p.options), correct: arr(k.correct).map(Number) };
    case "TRUE_FALSE":
      return { type: "TRUE_FALSE", ...common, correct: Boolean(k.correct) };
    case "GAP_FILL":
      return { type: "GAP_FILL", ...common, text: String(k.source ?? "") };
    case "SHORT_ANSWER":
      return { type: "SHORT_ANSWER", ...common, accepted: strs(k.accepted) };
    case "ORDERING":
      return { type: "ORDERING", ...common, items: strs(k.order) };
    case "MATCHING": {
      const left = strs(p.left);
      const right = strs(k.right);
      return { type: "MATCHING", ...common, pairs: left.map((l, i) => ({ left: l, right: right[i] ?? "" })) };
    }
  }
}

// ── Version publique ─────────────────────────────────────────────────────────

export type PublicQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  audioFileId: string | null;
  /** Image ou document joint (servi par /api/media après contrôle d'accès). */
  attachment: { id: string; mime: string; name: string } | null;
  options?: string[];
  segments?: string[];
  items?: string[];
  left?: string[];
  right?: string[];
};

function shuffled<T>(list: T[], random: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  // Ne jamais servir une liste déjà dans le bon ordre (sinon l'exercice se résout seul).
  if (a.length > 1 && a.every((v, i) => v === list[i])) a.push(a.shift()!);
  return a;
}

/** Ce que voit l'étudiant : jamais la clé de correction ; « à remettre dans l'ordre » et « associer » mélangés. */
export function toPublic(
  q: { id: string; type: QuestionType; prompt: string; payload: unknown; points: number; audioFileId: string | null; attachment?: PublicQuestion["attachment"] },
  random = Math.random,
): PublicQuestion {
  const p = (q.payload ?? {}) as Any;
  const base: PublicQuestion = {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: q.points,
    audioFileId: q.type === "LISTENING_MCQ" ? q.audioFileId : null,
    attachment: q.attachment ?? null,
  };
  switch (q.type) {
    case "MCQ":
    case "LISTENING_MCQ":
    case "MULTI_SELECT":
      return { ...base, options: strs(p.options) };
    case "GAP_FILL":
      return { ...base, segments: strs(p.segments) };
    case "ORDERING":
      return { ...base, items: shuffled(strs(p.items), random) };
    case "MATCHING":
      return { ...base, left: strs(p.left), right: shuffled(strs(p.right), random) };
    default:
      return base;
  }
}

// ── Correction ───────────────────────────────────────────────────────────────

/** Comparaison tolérante : casse, espaces, apostrophes typographiques, ponctuation finale. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?;,]+$/, "")
    .trim();
}

export const responseSchema = z.union([
  z.object({ choice: z.number().int().min(0) }),
  z.object({ choices: z.array(z.number().int().min(0)).max(20) }),
  z.object({ value: z.boolean() }),
  z.object({ blanks: z.array(z.string().max(200)).max(20) }),
  z.object({ text: z.string().max(500) }),
  z.object({ order: z.array(z.string().max(200)).max(20) }),
  z.object({ matches: z.array(z.string().max(200)).max(20) }),
]);
export type QuestionResponse = z.infer<typeof responseSchema>;

/** Note une réponse : `ratio` de 0 à 1 (crédit partiel pour les textes à trous et les associations). */
export function grade(type: QuestionType, answerKey: unknown, response: unknown): { correct: boolean; ratio: number } {
  const k = (answerKey ?? {}) as Any;
  const r = (response ?? {}) as Any;
  const all = (ok: boolean) => ({ correct: ok, ratio: ok ? 1 : 0 });
  switch (type) {
    case "MCQ":
    case "LISTENING_MCQ":
      return all(typeof r.choice === "number" && r.choice === Number(k.correct));
    case "MULTI_SELECT": {
      const want = arr(k.correct).map(Number).sort((a, b) => a - b);
      const got = [...new Set(arr(r.choices).map(Number))].sort((a, b) => a - b);
      return all(want.length === got.length && want.every((v, i) => v === got[i]));
    }
    case "TRUE_FALSE":
      return all(typeof r.value === "boolean" && r.value === Boolean(k.correct));
    case "SHORT_ANSWER": {
      const given = normalizeAnswer(String(r.text ?? ""));
      return all(given !== "" && strs(k.accepted).some((a) => normalizeAnswer(a) === given));
    }
    case "GAP_FILL": {
      const answers = arr(k.answers).map(strs);
      const blanks = strs(r.blanks);
      const ok = answers.filter((alts, i) => alts.some((a) => normalizeAnswer(a) === normalizeAnswer(blanks[i] ?? ""))).length;
      return { correct: ok === answers.length && answers.length > 0, ratio: answers.length ? ok / answers.length : 0 };
    }
    case "ORDERING": {
      const want = strs(k.order);
      const got = strs(r.order);
      return all(want.length === got.length && want.every((v, i) => v === got[i]));
    }
    case "MATCHING": {
      const want = strs(k.right);
      const got = strs(r.matches);
      const ok = want.filter((v, i) => v === got[i]).length;
      return { correct: ok === want.length && want.length > 0, ratio: want.length ? ok / want.length : 0 };
    }
  }
}

/** Bonne réponse, lisible, affichée après l'envoi. */
export function revealAnswer(type: QuestionType, payload: unknown, answerKey: unknown): string[] {
  const p = (payload ?? {}) as Any;
  const k = (answerKey ?? {}) as Any;
  const opts = strs(p.options);
  switch (type) {
    case "MCQ":
    case "LISTENING_MCQ":
      return [opts[Number(k.correct)] ?? ""];
    case "MULTI_SELECT":
      return arr(k.correct).map((i) => opts[Number(i)] ?? "");
    case "TRUE_FALSE":
      return [k.correct ? "true" : "false"];
    case "SHORT_ANSWER":
      return strs(k.accepted).slice(0, 3);
    case "GAP_FILL":
      return arr(k.answers).map((alts) => strs(alts)[0] ?? "");
    case "ORDERING":
      return strs(k.order);
    case "MATCHING": {
      const left = strs(p.left);
      return strs(k.right).map((r, i) => `${left[i]} → ${r}`);
    }
  }
}
