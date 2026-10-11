"use client";

import { ArrowLeft, CheckCircle2, Clock, Loader2, Play, RotateCcw, Trophy, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { startAttemptAction, submitAttemptAction } from "../actions";
import type { PublicQuestion } from "../questions";
import type { AttemptResult } from "../server";
import { isAnswered, QuestionInput, type Response } from "./question-inputs";

export type PlayerExercise = {
  id: string;
  title: string;
  instructions: string | null;
  levelCode: string;
  passingScore: number;
  timeLimitSec: number | null;
  shuffle: boolean;
  questions: PublicQuestion[];
  attemptsLeft: number | null;
  bestPercent: number | null;
};

function clock(sec: number) {
  const s = Math.max(0, sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Lecteur d'exercice : présentation, réponses (avec minuteur éventuel et envoi automatique
 * à la fin du temps), puis correction détaillée renvoyée par le serveur.
 */
export function ExercisePlayer({ exercise }: { exercise: PlayerExercise }) {
  const t = useTranslations("exercises.player");
  const te = useTranslations("errors");
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "play" | "result">("intro");
  const [attempt, setAttempt] = useState<{ id: string; deadline: number | null } | null>(null);
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [order, setOrder] = useState<PublicQuestion[]>(exercise.questions);
  const submitted = useRef(false);

  const answered = order.filter((q) => isAnswered(q, responses[q.id])).length;

  const start = async () => {
    setBusy(true);
    const res = await startAttemptAction(null, { exerciseId: exercise.id });
    setBusy(false);
    if (!res.ok || !res.data) return toast.error(te(res.ok ? "generic" : res.error));
    const startedAt = Date.parse(res.data.startedAt);
    setAttempt({ id: res.data.attemptId, deadline: exercise.timeLimitSec ? startedAt + exercise.timeLimitSec * 1000 : null });
    setResponses({});
    setResult(null);
    submitted.current = false;
    if (exercise.shuffle) setOrder([...exercise.questions].sort(() => Math.random() - 0.5));
    setNow(Date.now());
    setStep("play");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = useCallback(async () => {
    if (!attempt || submitted.current) return;
    submitted.current = true;
    setBusy(true);
    // « Remettre dans l'ordre » non touché : l'ordre affiché compte comme réponse.
    const all = Object.fromEntries(order.map((q) => [q.id, responses[q.id] ?? (q.type === "ORDERING" ? { order: q.items } : undefined)]));
    const res = await submitAttemptAction(null, { attemptId: attempt.id, responses: all });
    setBusy(false);
    if (!res.ok || !res.data) {
      submitted.current = false;
      return toast.error(te(res.ok ? "generic" : res.error));
    }
    setResult(res.data);
    setStep("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
    router.refresh();
  }, [attempt, order, responses, router, te]);

  // Minuteur : envoi automatique à la fin du temps.
  useEffect(() => {
    if (step !== "play" || !attempt?.deadline) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= attempt.deadline!) void submit();
    }, 1000);
    return () => clearInterval(id);
  }, [step, attempt, submit]);

  const remaining = attempt?.deadline ? Math.round((attempt.deadline - now) / 1000) : null;
  const byId = useMemo(() => new Map(result?.review.map((r) => [r.questionId, r]) ?? []), [result]);

  if (step === "intro") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <BackLink />
        <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <p className="mb-2 text-xs font-semibold tracking-[0.25em] text-brand-ink uppercase">{t("levelLabel", { level: exercise.levelCode })}</p>
          <h1 className="font-display text-3xl">{exercise.title}</h1>
          {exercise.instructions && <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{exercise.instructions}</p>}
          <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
            <Fact>{t("questionsCount", { count: exercise.questions.length })}</Fact>
            <Fact>{t("passingScore", { score: exercise.passingScore })}</Fact>
            <Fact>{exercise.timeLimitSec ? t("timeLimit", { minutes: Math.round(exercise.timeLimitSec / 60) }) : t("noTimeLimit")}</Fact>
            <Fact>{exercise.attemptsLeft === null ? t("unlimitedAttempts") : t("attemptsLeft", { count: exercise.attemptsLeft })}</Fact>
          </ul>
          {exercise.bestPercent !== null && <p className="mt-4 text-sm">{t("bestScore", { score: exercise.bestPercent })}</p>}
          <Button size="lg" className="mt-6 w-full bg-brand text-white hover:bg-brand/90 sm:w-auto" onClick={start} disabled={busy || exercise.attemptsLeft === 0}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {exercise.attemptsLeft === 0 ? t("noAttemptsLeft") : exercise.bestPercent === null ? t("start") : t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "result" && result) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <BackLink />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn("rounded-3xl p-8 text-center text-white shadow-lg", result.passed ? "bg-gradient-to-br from-[oklch(0.55_0.14_155)] to-[oklch(0.42_0.12_160)]" : "bg-night")}
          role="status"
        >
          {result.passed ? <Trophy className="mx-auto mb-3 size-10" aria-hidden /> : <RotateCcw className="mx-auto mb-3 size-10 opacity-80" aria-hidden />}
          <p className="font-display text-6xl tabular-nums">{result.percent} %</p>
          <p className="mt-1 text-white/80">{t("scoreDetail", { score: result.score, max: result.maxScore })}</p>
          <p className="mt-3 text-lg font-medium">{result.passed ? t("passed") : t("notPassed", { score: exercise.passingScore })}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {exercise.attemptsLeft !== 0 && (exercise.attemptsLeft === null || exercise.attemptsLeft > 1) && (
              <Button variant="secondary" onClick={start} disabled={busy}>
                <RotateCcw className="size-4" aria-hidden /> {t("retry")}
              </Button>
            )}
            <Button asChild variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link href="/app/exercises">{t("backToList")}</Link>
            </Button>
          </div>
        </motion.div>
        <h2 className="font-display text-2xl">{t("correction")}</h2>
        <ol className="grid gap-4">
          {order.map((q, i) => {
            const r = byId.get(q.id);
            return (
              <li key={q.id} className={cn("rounded-2xl border-2 bg-card p-5", r?.correct ? "border-success/40" : "border-destructive/30")}>
                <p className="mb-3 flex items-start gap-2 font-medium">
                  {r?.correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label={t("correct")} /> : <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-label={t("incorrect")} />}
                  <span className="flex-1 whitespace-pre-wrap">
                    {i + 1}. {q.prompt}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{t("points", { got: r?.pointsAwarded ?? 0, max: q.points })}</span>
                </p>
                <QuestionInput q={q} value={responses[q.id]} onChange={() => undefined} disabled tone={r?.correct ? "correct" : "wrong"} />
                {!r?.correct && r && (
                  <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm">
                    <span className="font-semibold">{t("expected")} </span>
                    {q.type === "TRUE_FALSE" ? t(r.answer[0] === "true" ? "true" : "false") : r.answer.join(q.type === "ORDERING" ? " → " : " · ")}
                  </p>
                )}
                {r?.explanation && <p className="mt-2 text-sm text-muted-foreground">💡 {r.explanation}</p>}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-28">
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <p className="min-w-0 flex-1 truncate font-medium">{exercise.title}</p>
          {remaining !== null && (
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums", remaining <= 60 ? "bg-destructive text-white" : "bg-muted")} role="timer">
              <Clock className="size-4" aria-hidden /> {clock(remaining)}
            </span>
          )}
          <span className="text-sm text-muted-foreground tabular-nums">
            {answered}/{order.length}
          </span>
        </div>
        <Progress value={(answered / Math.max(1, order.length)) * 100} className="mt-2 h-1.5" aria-label={t("progress")} />
      </div>
      <ol className="grid gap-5">
        <AnimatePresence initial={false}>
          {order.map((q, i) => (
            <motion.li key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.04 }} className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="mb-4 flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand-ink tabular-nums">{i + 1}</span>
                <span className="flex-1 text-lg font-medium whitespace-pre-wrap">{q.prompt}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t("pointsShort", { count: q.points })}</span>
              </p>
              <QuestionInput q={q} value={responses[q.id] as Response} onChange={(v) => setResponses((r) => ({ ...r, [q.id]: v }))} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{answered < order.length ? t("unanswered", { count: order.length - answered }) : t("allAnswered")}</p>
          <Button size="lg" onClick={submit} disabled={busy} className="bg-brand text-white hover:bg-brand/90">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
      <CheckCircle2 className="size-4 text-brand-ink" aria-hidden />
      {children}
    </li>
  );
}

function BackLink() {
  const t = useTranslations("exercises.player");
  return (
    <Link href="/app/exercises" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden /> {t("backToList")}
    </Link>
  );
}
