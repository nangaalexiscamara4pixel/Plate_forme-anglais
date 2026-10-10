"use client";

import { Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createLocalVideoAction, createMuxVideoAction } from "../actions";
import { useUpload } from "./use-upload";

/** Ajout d'une vidéo : upload direct vers Mux (production) ou stockage local (développement). */
export function VideoUploader({ muxEnabled }: { muxEnabled: boolean }) {
  const t = useTranslations("admin.media");
  const te = useTranslations("errors");
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [muxProgress, setMuxProgress] = useState<number | null>(null);
  const local = useUpload("LESSON_VIDEO");
  const busy = muxProgress !== null || local.state.status === "uploading";

  const onFile = async (file: File) => {
    const name = title.trim() || file.name.replace(/\.[^.]+$/, "");
    if (muxEnabled) {
      const res = await createMuxVideoAction(null, { title: name });
      const uploadUrl = res.ok ? res.data?.uploadUrl : undefined;
      if (!uploadUrl) return toast.error(!res.ok && te.has(res.error) ? te(res.error) : te("generic"));
      setMuxProgress(0);
      const ok = await new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.upload.onprogress = (e) => e.lengthComputable && setMuxProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => resolve(xhr.status < 300);
        xhr.onerror = () => resolve(false);
        xhr.send(file);
      });
      setMuxProgress(null);
      if (!ok) return toast.error(te("UPLOAD_FAILED"));
      toast.success(t("muxProcessing"));
    } else {
      const media = await local.upload(file);
      if (!media) return;
      const res = await createLocalVideoAction(null, { mediaId: media.id, title: name });
      if (!res.ok) return toast.error(te.has(res.error) ? te(res.error) : te("generic"));
      toast.success(t("videoAdded"));
    }
    setTitle("");
    router.refresh();
  };

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="grid gap-2">
        <Label htmlFor="video-title">{t("videoTitle")}</Label>
        <Input id="video-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={t("videoTitlePlaceholder")} />
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="video/mp4,video/webm"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
      <Button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
        {t("uploadVideo")}
      </Button>
      {(muxProgress !== null || local.state.status === "uploading") && (
        <Progress className="sm:col-span-2" value={muxProgress ?? (local.state.status === "uploading" ? local.state.progress : 0)} aria-label={t("uploading")} />
      )}
      {local.state.status === "error" && <p className="text-sm text-destructive sm:col-span-2">{te.has(local.state.error) ? te(local.state.error) : te("generic")}</p>}
      <p className="text-xs text-muted-foreground sm:col-span-2">{muxEnabled ? t("muxHint") : t("localHint")}</p>
    </div>
  );
}

/** Ajout d'un fichier (audio, image, PDF) à la médiathèque. */
export function FileUploader() {
  const t = useTranslations("admin.media");
  const te = useTranslations("errors");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [purpose, setPurpose] = useState<"LESSON_AUDIO" | "LESSON_IMAGE" | "LESSON_DOCUMENT">("LESSON_AUDIO");
  const { state, upload } = useUpload(purpose);
  const accept = { LESSON_AUDIO: "audio/*", LESSON_IMAGE: "image/jpeg,image/png,image/webp,image/avif", LESSON_DOCUMENT: "application/pdf" }[purpose];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="purpose">{t("fileType")}</Label>
          <select id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {(["LESSON_AUDIO", "LESSON_IMAGE", "LESSON_DOCUMENT"] as const).map((p) => (
              <option key={p} value={p}>
                {t(`purpose.${p}`)}
              </option>
            ))}
          </select>
        </div>
        <input
          ref={input}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (await upload(f)) {
              toast.success(t("fileAdded"));
              router.refresh();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={state.status === "uploading"}>
          <Upload className="size-4" aria-hidden /> {t("uploadFile")}
        </Button>
      </div>
      {state.status === "uploading" && <Progress value={state.progress} aria-label={t("uploading")} />}
      {state.status === "error" && <p className="text-sm text-destructive">{te.has(state.error) ? te(state.error) : te("generic")}</p>}
    </div>
  );
}
