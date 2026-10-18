"use client";

import { FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Loader2, Paperclip, Presentation, Trash2, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUpload, type UploadedFile } from "@/features/content/components/use-upload";
import { OpenFileButton } from "@/components/file-viewer";
import { fileKind } from "@/lib/files";
import { cn } from "@/lib/utils";

export { ACCEPT, fileKind } from "@/lib/files";

export function FileIcon({ mime, className }: { mime: string; className?: string }) {
  const kind = fileKind(mime);
  const Icon =
    kind === "image" ? FileImage : kind === "video" ? FileVideo : kind === "audio" ? FileAudio : kind === "slides" ? Presentation : kind === "sheet" ? FileSpreadsheet : FileText;
  const tone = { image: "text-sky-600", video: "text-fuchsia-600", pdf: "text-red-600", slides: "text-orange-600", sheet: "text-emerald-600", word: "text-blue-600", audio: "text-violet-600", other: "text-muted-foreground" }[kind];
  return <Icon className={cn("shrink-0", tone, className)} aria-hidden />;
}

/**
 * Zone d'ajout de fichier : clic, glisser-déposer, ou collage d'une capture d'écran (Ctrl + V)
 * après avoir cliqué dans la zone. Envoi direct vers le stockage avec progression.
 */
export function FileDrop({
  uploader,
  accept,
  value,
  onChange,
  label,
  hint,
  pasteImages = true,
  disabled,
}: {
  uploader: Parameters<typeof useUpload>[0];
  accept: string;
  value?: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  label?: string;
  hint?: string;
  pasteImages?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("files");
  const te = useTranslations("errors");
  const input = useRef<HTMLInputElement>(null);
  const { state, upload } = useUpload(uploader);
  const [over, setOver] = useState(false);
  const busy = state.status === "uploading";

  const send = async (file: File | undefined | null) => {
    if (!file || busy || disabled) return;
    const res = await upload(file);
    if (res) onChange(res);
  };

  const onPaste = (e: ClipboardEvent) => {
    if (!pasteImages) return;
    const item = [...e.clipboardData.items].find((i) => i.kind === "file");
    const file = item?.getAsFile();
    if (!file) return;
    e.preventDefault();
    // Une capture collée n'a pas de nom : on en donne un daté.
    const named = file.name && file.name !== "image.png" ? file : new File([file], `capture-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.png`, { type: file.type || "image/png" });
    void send(named);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void send(e.dataTransfer.files[0]);
  };

  return (
    <div className="grid gap-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      {value ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3">
          {fileKind(value.mime) === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu d'un fichier privé (URL signée)
            <img src={`/api/media/${value.id}`} alt="" className="h-16 w-24 rounded-md border bg-background object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-lg bg-background">
              <FileIcon mime={value.mime} className="size-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name || t("file")}</p>
            <OpenFileButton file={value} className="text-xs text-brand-ink hover:underline" />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => input.current?.click()} disabled={busy || disabled}>
            {t("replace")}
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} disabled={busy || disabled} aria-label={t("remove")} className="text-destructive hover:text-destructive">
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-disabled={disabled || busy}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
          onPaste={onPaste}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition outline-none focus-visible:border-primary focus-visible:bg-primary/5",
            over ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
            (disabled || busy) && "pointer-events-none opacity-70",
          )}
        >
          {busy ? <Loader2 className="size-6 animate-spin text-primary" aria-hidden /> : <UploadCloud className="size-6 text-muted-foreground" aria-hidden />}
          <p className="text-sm font-medium">{busy ? t("uploading", { progress: state.progress }) : t("drop")}</p>
          <p className="text-xs text-muted-foreground">{hint ?? (pasteImages ? t("pasteHint") : t("clickHint"))}</p>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void send(file);
        }}
      />
      {busy && <Progress value={state.progress} aria-label={t("progress")} className="h-1.5" />}
      {state.status === "error" && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <Paperclip className="size-4" aria-hidden />
          {te.has(state.error) ? te(state.error) : te("generic")}
        </p>
      )}
    </div>
  );
}
