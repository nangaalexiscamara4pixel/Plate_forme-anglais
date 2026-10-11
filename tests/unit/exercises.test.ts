import { describe, expect, it } from "vitest";
import { grade, normalizeAnswer, parseGapText, questionInputSchema, revealAnswer, toInput, toPublic, toStored, type QuestionInput } from "@/features/exercises/questions";

const store = (q: QuestionInput) => ({ id: "q1", ...toStored(questionInputSchema.parse(q)) });

describe("questions : saisie et stockage", () => {
  it("texte à trous : segments et variantes acceptées", () => {
    expect(parseGapText("I {am|'m} a student and she {is}.")).toEqual({ segments: ["I ", " a student and she ", "."], answers: [["am", "'m"], ["is"]] });
  });
  it("refuse une bonne réponse hors des options et un texte sans blanc", () => {
    expect(questionInputSchema.safeParse({ type: "MCQ", prompt: "?", options: ["a", "b"], correct: 2 }).success).toBe(false);
    expect(questionInputSchema.safeParse({ type: "GAP_FILL", prompt: "?", text: "no gaps here" }).success).toBe(false);
  });
  it("aller-retour saisie → stockage → formulaire sans perte", () => {
    const inputs: QuestionInput[] = [
      { type: "MCQ", prompt: "Pick", options: ["a", "b", "c"], correct: 1, points: 2 },
      { type: "MULTI_SELECT", prompt: "Pick", options: ["a", "b", "c"], correct: [0, 2], points: 1 },
      { type: "TRUE_FALSE", prompt: "Sky is blue", correct: true, points: 1 },
      { type: "GAP_FILL", prompt: "Fill", text: "I {am} here", points: 1 },
      { type: "SHORT_ANSWER", prompt: "Capital of UK?", accepted: ["London"], points: 1 },
      { type: "ORDERING", prompt: "Order", items: ["I", "am", "happy"], points: 1 },
      { type: "MATCHING", prompt: "Match", pairs: [{ left: "cat", right: "chat" }, { left: "dog", right: "chien" }], points: 1 },
    ];
    for (const input of inputs) expect(toInput(toStored(input))).toEqual({ ...input, explanation: undefined });
  });
});

describe("questions : version publique", () => {
  it("ne contient jamais la clé de correction", () => {
    const q = store({ type: "SHORT_ANSWER", prompt: "Capital of UK?", accepted: ["London"], points: 1 });
    expect(JSON.stringify(toPublic(q))).not.toContain("London");
  });
  it("mélange « remettre dans l'ordre » sans jamais servir la solution", () => {
    const q = store({ type: "ORDERING", prompt: "Order", items: ["I", "am", "happy"], points: 1 });
    for (let i = 0; i < 20; i++) expect(toPublic(q).items).not.toEqual(["I", "am", "happy"]);
    expect([...toPublic(q).items!].sort()).toEqual(["I", "am", "happy"].sort());
  });
  it("n'expose l'audio que pour la compréhension orale", () => {
    const q = store({ type: "LISTENING_MCQ", prompt: "Listen", options: ["a", "b"], correct: 0, audioFileId: "media1", points: 1 });
    expect(toPublic(q).audioFileId).toBe("media1");
  });
});

describe("questions : correction", () => {
  it("tolère casse, espaces, apostrophes typographiques et ponctuation finale", () => {
    expect(normalizeAnswer("  I’M   Fine. ")).toBe("i'm fine");
    const q = store({ type: "SHORT_ANSWER", prompt: "?", accepted: ["I'm fine"], points: 1 });
    expect(grade("SHORT_ANSWER", q.answerKey, { text: "i’m FINE!" }).correct).toBe(true);
    expect(grade("SHORT_ANSWER", q.answerKey, { text: "" }).correct).toBe(false);
  });
  it("choix unique, multiple, vrai/faux", () => {
    const mcq = store({ type: "MCQ", prompt: "?", options: ["a", "b"], correct: 1, points: 1 });
    expect(grade("MCQ", mcq.answerKey, { choice: 1 }).correct).toBe(true);
    expect(grade("MCQ", mcq.answerKey, { choice: 0 }).correct).toBe(false);
    const multi = store({ type: "MULTI_SELECT", prompt: "?", options: ["a", "b", "c"], correct: [0, 2], points: 1 });
    expect(grade("MULTI_SELECT", multi.answerKey, { choices: [2, 0] }).correct).toBe(true);
    expect(grade("MULTI_SELECT", multi.answerKey, { choices: [0] }).correct).toBe(false);
    expect(grade("MULTI_SELECT", multi.answerKey, { choices: [0, 1, 2] }).correct).toBe(false);
    const tf = store({ type: "TRUE_FALSE", prompt: "?", correct: false, points: 1 });
    expect(grade("TRUE_FALSE", tf.answerKey, { value: false }).correct).toBe(true);
  });
  it("texte à trous et associations : crédit partiel", () => {
    const gap = store({ type: "GAP_FILL", prompt: "?", text: "I {am|'m} a {student}", points: 2 });
    expect(grade("GAP_FILL", gap.answerKey, { blanks: ["’m", "Student"] })).toEqual({ correct: true, ratio: 1 });
    expect(grade("GAP_FILL", gap.answerKey, { blanks: ["is", "student"] })).toEqual({ correct: false, ratio: 0.5 });
    const match = store({ type: "MATCHING", prompt: "?", pairs: [{ left: "cat", right: "chat" }, { left: "dog", right: "chien" }], points: 1 });
    expect(grade("MATCHING", match.answerKey, { matches: ["chat", "chat"] })).toEqual({ correct: false, ratio: 0.5 });
  });
  it("réponse absente ou malformée : 0, sans erreur", () => {
    const q = store({ type: "ORDERING", prompt: "?", items: ["a", "b"], points: 1 });
    expect(grade("ORDERING", q.answerKey, undefined)).toEqual({ correct: false, ratio: 0 });
    expect(grade("ORDERING", q.answerKey, { order: ["a", "b"] }).correct).toBe(true);
  });
  it("affiche la bonne réponse après l'envoi", () => {
    const q = store({ type: "MATCHING", prompt: "?", pairs: [{ left: "cat", right: "chat" }, { left: "dog", right: "chien" }], points: 1 });
    expect(revealAnswer("MATCHING", q.payload, q.answerKey)).toEqual(["cat → chat", "dog → chien"]);
  });
});
