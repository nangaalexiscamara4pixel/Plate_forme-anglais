"use client";

import { CheckCircle2, Circle, Loader2, Mic, MessageSquareText, RotateCcw, Send, Square, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { FileDrop } from "@/components/file-drop";
import type { UploadedFile, Uploader } from "@/features/content/components/use-upload";
import { ACCEPT } from "@/lib/files";
import {
  confirmRecordingUploadAction,
  confirmSubmissionFileUploadAction,
  requestRecordingUploadAction,
  requestSubmissionFileUploadAction,
  saveDraftAction,
  submitAssignmentAction,
} from "../actions";
import { MaterialList, type Material } from "./materials";

export type WorkspaceSubmission = {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "RETURNED";
  version: number;
  text: string | null;
  audioFileId: string | null;
  durationSec: number | null;
  wordCount: number | null;
  file: { id: string; mime: string; originalName: string | null } | null;
  submittedAt: string | null;
  feedback: { score: number | null; comment: string | null; returnedAt: string | null } | null;
};

export type WorkspaceAssignment = {
  id: string;
  title: string;
  prompt: string;
  skill: "WRITING" | "SPEAKING";
  levelCode: string;
  minWords: number | null;
  maxWords: number | null;
  maxDurationSec: number | null;
  materials: Material[];
};

const countWords = (text: string) => (text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
/** Horloge des enregistrements (appelée uniquement depuis les gestionnaires d'événements). */
const clockNow = () => Date.now();
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Espace de travail d'un devoir : brouillon enregistré automatiquement, envoi, puis retour de
 * l'enseignant. Après correction, une nouvelle version peut être déposée.
 */
export function AssignmentWorkspace({ assignment, submissions }: { assignment: WorkspaceAssignment; submissions: WorkspaceSubmission[] }) {
  const t = useTranslations("assignments.student");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const latest = submissions[0] ?? null;
  const locked = latest?.status === "SUBMITTED" || latest?.status === "IN_REVIEW";
  const returned = latest?.status === "RETURNED";
  const [revising, setRevising] = useState(false);
  const editing = !locked && (!returned || revising);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    const res = await submitAssignmentAction(null, { assignmentId: assignment.id });
    setSending(false);
    if (!res.ok) return toast.error(te(res.error));
    toast.success(t("sent"));
    setRevising(false);
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="grid content-start gap-6">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold tracking-[0.2em] text-brand-ink uppercase">{t("instructions")}</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{assignment.prompt}</p>
          {assignment.materials.length > 0 && (
            <div className="mt-4 grid gap-2">
              <p className="text-sm font-medium">{t("materials")}</p>
              <MaterialList items={assignment.materials} />
            </div>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            {assignment.skill === "WRITING"
              ? assignment.minWords && assignment.maxWords
                ? t("wordsRange", { min: assignment.minWords, max: assignment.maxWords })
                : assignment.minWords
                  ? t("wordsMin", { min: assignment.minWords })
                  : assignment.maxWords
                    ? t("wordsMax", { max: assignment.maxWords })
                    : t("wordsFree")
              : t("durationMax", { duration: mmss(assignment.maxDurationSec ?? 120) })}
          </p>
        </section>

        {returned && latest?.feedback && (
          <section className="rounded-2xl border-2 border-success/40 bg-success/5 p-6" aria-labelledby="feedback-title">
            <h2 id="feedback-title" className="mb-3 flex items-center gap-2 font-display text-xl">
              <MessageSquareText className="size-5 text-success" aria-hidden /> {t("feedbackTitle")}
              {latest.feedback.score !== null && <span className="ml-auto rounded-full bg-success px-3 py-1 text-sm font-semibold text-white tabular-nums">{latest.feedback.score}/100</span>}
            </h2>
            <p className="whitespace-pre-wrap leading-relaxed">{latest.feedback.comment}</p>
            {!revising && (
              <Button variant="outline" className="mt-4" onClick={() => setRevising(true)}>
                <RotateCcw className="size-4" aria-hidden /> {t("newVersion")}
              </Button>
            )}
          </section>
        )}

        {editing ? (
          assignment.skill === "WRITING" ? (
            <WritingEditor
              assignment={assignment}
              initial={latest?.text ?? ""}
              initialFile={latest?.file ? { id: latest.file.id, name: latest.file.originalName ?? "", mime: latest.file.mime } : null}
              onSubmit={submit}
              sending={sending}
            />
          ) : (
            <SpeakingRecorder assignment={assignment} initial={latest?.status === "DRAFT" ? latest : null} onSubmit={submit} sending={sending} />
          )
        ) : (
          latest && (
            <section className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="mb-3 font-medium">{t("yourWork", { version: latest.version })}</h2>
              {latest.text && <p className="whitespace-pre-wrap leading-relaxed">{latest.text}</p>}
              {latest.audioFileId && <audio controls src={`/api/media/${latest.audioFileId}`} className="w-full" />}
              {latest.file && (
                <div className="mt-4">
                  <MaterialList items={[{ mediaId: latest.file.id, name: latest.file.originalName ?? "", mime: latest.file.mime }]} />
                </div>
              )}
              {locked && <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{t("waiting")}</p>}
            </section>
          )
        )}
      </div>

      <aside className="h-fit rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-3 font-medium">{t("history")}</h2>
        {submissions.filter((s) => s.status !== "DRAFT").length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <ol className="grid gap-3 text-sm">
            {submissions
              .filter((s) => s.status !== "DRAFT")
              .map((s) => (
                <li key={s.id} className="flex items-start gap-2">
                  {s.status === "RETURNED" ? <CheckCircle2 className="mt-0.5 size-4 text-success" aria-hidden /> : <Circle className="mt-0.5 size-4 text-muted-foreground" aria-hidden />}
                  <div>
                    <p className="font-medium">{t("versionN", { n: s.version })}</p>
                    <p className="text-muted-foreground">
                      {t(`status.${s.status}`)}
                      {s.submittedAt && ` · ${format.dateTime(new Date(s.submittedAt), { dateStyle: "medium" })}`}
                      {s.feedback?.score != null && ` · ${s.feedback.score}/100`}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        )}
      </aside>
    </div>
  );
}

function SubmitBar({ disabled, sending, onSubmit, info }: { disabled: boolean; sending: boolean; onSubmit: () => void; info: React.ReactNode }) {
  const t = useTranslations("assignments.student");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm">{info}</div>
      <Button onClick={onSubmit} disabled={disabled || sending} className="bg-brand text-white hover:bg-brand/90">
        {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {t("submit")}
      </Button>
    </div>
  );
}

/** Envoi d'un fichier de copie par l'étudiant (rattaché à son compte). */
function studentFileUploader(assignmentId: string): Uploader {
  return {
    request: (file) => requestSubmissionFileUploadAction(null, { assignmentId, ...file }),
    confirm: (mediaId) => confirmSubmissionFileUploadAction(null, { mediaId }),
  };
}

function WritingEditor({
  assignment,
  initial,
  initialFile,
  onSubmit,
  sending,
}: {
  assignment: WorkspaceAssignment;
  initial: string;
  initialFile: UploadedFile | null;
  onSubmit: () => void;
  sending: boolean;
}) {
  const t = useTranslations("assignments.student");
  const te = useTranslations("errors");
  const [text, setText] = useState(initial);
  const [file, setFile] = useState<UploadedFile | null>(initialFile);
  const [uploader] = useState(() => studentFileUploader(assignment.id));
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const words = countWords(text);
  // Avec un fichier joint (copie scannée, document Word…), le texte saisi devient facultatif.
  const tooShort = !file && !!assignment.minWords && words < assignment.minWords;
  const tooLong = !!assignment.maxWords && words > assignment.maxWords;

  // Enregistrement automatique du brouillon (1,2 s après la dernière frappe).
  const persist = async (value: string) => {
    setSaved("saving");
    const res = await saveDraftAction(null, { assignmentId: assignment.id, text: value });
    setSaved(res.ok ? "saved" : "error");
    return res.ok;
  };
  const onChange = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(value), 1200);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const send = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (await persist(text)) onSubmit();
  };
  const attach = async (f: UploadedFile | null) => {
    const res = await saveDraftAction(null, { assignmentId: assignment.id, fileId: f?.id ?? null });
    if (!res.ok) return toast.error(te(res.error));
    setFile(f);
  };

  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-6 shadow-sm">
      <label htmlFor="assignment-text" className="font-medium">
        {t("yourText")}
      </label>
      <textarea
        id="assignment-text"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={14}
        maxLength={40000}
        lang="en"
        placeholder={t("textPlaceholder")}
        className="w-full resize-y rounded-xl border border-input bg-transparent p-4 text-base leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      />
      <FileDrop
        uploader={uploader}
        accept={ACCEPT.documentOrImage}
        label={t("attachFile")}
        hint={t("attachHint")}
        value={file}
        onChange={(f) => void attach(f)}
      />
      <SubmitBar
        disabled={(words === 0 && !file) || tooShort || tooLong}
        sending={sending}
        onSubmit={send}
        info={
          <span className="flex flex-wrap items-center gap-3">
            <span className={cn("font-semibold tabular-nums", tooShort || tooLong ? "text-destructive" : "text-success")}>{t("words", { count: words })}</span>
            {tooShort && <span className="text-muted-foreground">{t("needMore", { count: assignment.minWords! - words })}</span>}
            {tooLong && <span className="text-muted-foreground">{t("tooMany", { count: words - assignment.maxWords! })}</span>}
            <span className="text-xs text-muted-foreground" role="status">
              {saved === "saving" ? t("saving") : saved === "saved" ? t("draftSaved") : saved === "error" ? t("saveError") : ""}
            </span>
          </span>
        }
      />
    </section>
  );
}

function SpeakingRecorder({ assignment, initial, onSubmit, sending }: { assignment: WorkspaceAssignment; initial: WorkspaceSubmission | null; onSubmit: () => void; sending: boolean }) {
  const t = useTranslations("assignments.student");
  const te = useTranslations("errors");
  const max = assignment.maxDurationSec ?? 120;
  const [audio, setAudio] = useState<{ id: string; duration: number } | null>(initial?.audioFileId ? { id: initial.audioFileId, duration: initial.durationSec ?? 0 } : null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const started = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (tick.current) clearInterval(tick.current);
    recorder.current?.stream.getTracks().forEach((tr) => tr.stop());
  }, []);

  const stop = () => recorder.current?.state === "recording" && recorder.current.stop();

  const record = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return toast.error(t("micDenied"));
    }
    const mime = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      if (tick.current) clearInterval(tick.current);
      stream.getTracks().forEach((tr) => tr.stop());
      setRecording(false);
      const duration = Math.round((clockNow() - started.current) / 1000);
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      setPreview(URL.createObjectURL(blob));
      await upload(blob, duration);
    };
    recorder.current = rec;
    started.current = clockNow();
    setElapsed(0);
    rec.start(1000);
    setRecording(true);
    tick.current = setInterval(() => {
      const s = (clockNow() - started.current) / 1000;
      setElapsed(s);
      if (s >= max) stop();
    }, 250);
  };

  const upload = async (blob: Blob, duration: number) => {
    setUploading(true);
    try {
      const req = await requestRecordingUploadAction(null, { assignmentId: assignment.id, mime: blob.type, size: blob.size });
      if (!req.ok || !req.data) throw new Error(req.ok ? "generic" : req.error);
      const { mediaId, upload: target } = req.data;
      const put = await fetch(target.url, { method: target.method, headers: target.headers, body: blob });
      if (!put.ok) throw new Error("UPLOAD_FAILED");
      const confirmed = await confirmRecordingUploadAction(null, { mediaId });
      if (!confirmed.ok) throw new Error(confirmed.error);
      const saved = await saveDraftAction(null, { assignmentId: assignment.id, audioFileId: mediaId, durationSec: duration });
      if (!saved.ok) throw new Error(saved.error);
      setAudio({ id: mediaId, duration });
    } catch (err) {
      toast.error(te(err instanceof Error ? err.message : "generic"));
    } finally {
      setUploading(false);
    }
  };

  const discard = async () => {
    setAudio(null);
    setPreview(null);
    await saveDraftAction(null, { assignmentId: assignment.id, audioFileId: null, durationSec: 0 });
  };

  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="font-medium">{t("yourRecording")}</h2>
      {recording ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <span className="relative flex size-20 items-center justify-center rounded-full bg-destructive text-white">
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" aria-hidden />
            <Mic className="relative size-8" aria-hidden />
          </span>
          <p className="font-display text-3xl tabular-nums" role="timer">
            {mmss(elapsed)} <span className="text-base text-muted-foreground">/ {mmss(max)}</span>
          </p>
          <Button variant="destructive" onClick={stop}>
            <Square className="size-4" aria-hidden /> {t("stop")}
          </Button>
        </div>
      ) : audio ? (
        <div className="grid gap-3">
          <audio controls src={preview ?? `/api/media/${audio.id}`} className="w-full" />
          <p className="text-sm text-muted-foreground">{t("recordedDuration", { duration: mmss(audio.duration) })}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={discard} disabled={sending}>
              <Trash2 className="size-4" aria-hidden /> {t("rerecord")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Button size="lg" onClick={record} disabled={uploading} className="size-20 rounded-full bg-brand p-0 text-white hover:bg-brand/90" aria-label={t("record")}>
            {uploading ? <Loader2 className="size-8 animate-spin" aria-hidden /> : <Mic className="size-8" aria-hidden />}
          </Button>
          <p className="text-sm text-muted-foreground">{uploading ? t("uploading") : t("recordHint", { duration: mmss(max) })}</p>
        </div>
      )}
      <SubmitBar disabled={!audio || recording || uploading} sending={sending} onSubmit={onSubmit} info={<span className="text-muted-foreground">{t("speakingTip")}</span>} />
    </section>
  );
}
