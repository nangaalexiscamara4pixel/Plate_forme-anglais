"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { Download, FileQuestion, Loader2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { fileKind } from "@/lib/files";
import { cn } from "@/lib/utils";

export type ViewerFile = { id: string; name: string; mime: string };

const src = (id: string) => `/api/media/${id}`;
const downloadHref = (id: string) => `/api/media/${id}?download=1`;

/**
 * Visionneuse du site : le fichier s'ouvre dans une fenêtre par-dessus la page (image, vidéo,
 * audio, PDF), avec « Télécharger » et « Fermer ». À la fermeture, la lecture s'arrête.
 * Word, PowerPoint et Excel ne peuvent pas être affichés par le navigateur : on propose le
 * téléchargement. Les fichiers restent privés (liens signés émis après contrôle d'accès).
 */
export function FileViewer({ file, open, onOpenChange }: { file: ViewerFile | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("files");
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          aria-describedby={undefined}
        >
          {file && (
            <>
              <header className="flex items-center gap-3 px-4 py-3 text-white sm:px-6">
                <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-sm font-medium sm:text-base">{file.name || t("file")}</DialogPrimitive.Title>
                <a
                  href={downloadHref(file.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm font-medium hover:bg-white/20"
                >
                  <Download className="size-4" aria-hidden />
                  <span className="max-sm:sr-only">{t("download")}</span>
                </a>
                <DialogPrimitive.Close className="inline-flex size-10 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20" aria-label={t("close")}>
                  <X className="size-5" aria-hidden />
                </DialogPrimitive.Close>
              </header>
              <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-6 sm:pb-6" onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}>
                <ViewerBody file={file} />
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Type absent, générique (« image/* ») ou inconnu : la page ne le connaissait pas avec certitude. */
function needsInfo(file: ViewerFile) {
  return !file.mime || file.mime.includes("*") || file.mime === "application/octet-stream" || fileKind(file.mime) === "other";
}

function ViewerBody({ file }: { file: ViewerFile }) {
  const t = useTranslations("files");
  const [resolved, setResolved] = useState<{ for: string; file: ViewerFile | null; error: boolean } | null>(null);
  const unsure = needsInfo(file);
  useEffect(() => {
    if (!unsure) return;
    let cancelled = false;
    fetch(`${src(file.id)}?info=1`)
      .then((r) => (r.ok ? (r.json() as Promise<{ name: string; mime: string }>) : Promise.reject(new Error(String(r.status)))))
      .then((info) => !cancelled && setResolved({ for: file.id, file: { id: file.id, name: file.name || info.name, mime: info.mime }, error: false }))
      .catch(() => !cancelled && setResolved({ for: file.id, file: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [file.id, file.name, unsure]);

  if (!unsure) return <ViewerContent file={file} />;
  if (!resolved || resolved.for !== file.id) return <Loader2 className="size-8 animate-spin text-white" aria-label={t("loading")} />;
  if (!resolved.file) {
    return (
      <Unavailable
        message={t("loadError")}
        action={
          <a href={downloadHref(file.id)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 font-semibold text-night hover:bg-white/90">
            <Download className="size-4" aria-hidden /> {t("download")}
          </a>
        }
      />
    );
  }
  return <ViewerContent file={resolved.file} />;
}

function ViewerContent({ file }: { file: ViewerFile }) {
  const t = useTranslations("files");
  const kind = fileKind(file.mime);
  const [zoom, setZoom] = useState(false);

  if (kind === "image") {
    return (
      <div className={cn("relative max-h-full max-w-full", zoom ? "overflow-auto" : "flex items-center justify-center")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par URL signée */}
        <img
          src={src(file.id)}
          alt={file.name}
          onClick={() => setZoom((z) => !z)}
          className={cn("rounded-lg bg-white/5 shadow-2xl", zoom ? "max-w-none cursor-zoom-out" : "max-h-[calc(100dvh-6rem)] max-w-full cursor-zoom-in object-contain")}
        />
        <button
          type="button"
          onClick={() => setZoom((z) => !z)}
          className="absolute right-3 bottom-3 inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          aria-label={zoom ? t("zoomOut") : t("zoomIn")}
        >
          {zoom ? <ZoomOut className="size-5" aria-hidden /> : <ZoomIn className="size-5" aria-hidden />}
        </button>
      </div>
    );
  }
  if (kind === "video") {
    return <video src={src(file.id)} controls autoPlay playsInline className="max-h-[calc(100dvh-6rem)] max-w-full rounded-lg bg-black shadow-2xl" />;
  }
  if (kind === "audio") {
    return (
      <div className="w-full max-w-xl rounded-2xl bg-white/10 p-6 text-center text-white">
        <p className="mb-4 font-medium">{file.name}</p>
        <audio src={src(file.id)} controls autoPlay className="w-full" />
      </div>
    );
  }
  if (kind === "pdf") return <PdfFrame file={file} />;
  if (kind === "slides" || kind === "word" || kind === "sheet") return <OfficeFrame file={file} />;
  return (
    <Unavailable
      message={t("previewUnavailable", { kind: t(`kinds.${kind}`) })}
      action={
        <a href={downloadHref(file.id)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 font-semibold text-night hover:bg-white/90">
          <Download className="size-4" aria-hidden /> {t("download")}
        </a>
      }
    />
  );
}

/** PDF : récupéré puis affiché depuis une copie locale (le stockage impose le téléchargement). */
function PdfFrame({ file }: { file: ViewerFile }) {
  const t = useTranslations("files");
  const [state, setState] = useState<{ url: string | null; error: boolean }>({ url: null, error: false });
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fetch(src(file.id))
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([b], { type: "application/pdf" }));
        setState({ url, error: false });
      })
      .catch(() => !cancelled && setState({ url: null, error: true }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id]);

  if (state.error) {
    return (
      <Unavailable
        message={t("loadError")}
        action={
          <a href={downloadHref(file.id)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 font-semibold text-night">
            <Download className="size-4" aria-hidden /> {t("download")}
          </a>
        }
      />
    );
  }
  if (!state.url) return <Loader2 className="size-8 animate-spin text-white" aria-label={t("loading")} />;
  return <iframe src={state.url} title={file.name} className="size-full max-w-5xl rounded-lg bg-white shadow-2xl" />;
}

/** PowerPoint, Word, Excel : affichés par le lecteur gratuit de Microsoft (Office Online). */
function OfficeFrame({ file }: { file: ViewerFile }) {
  const t = useTranslations("files");
  const [state, setState] = useState<{ url: string | null; error: boolean }>({ url: null, error: false });
  useEffect(() => {
    let cancelled = false;
    fetch(`${src(file.id)}?preview=office`)
      .then((r) => (r.ok ? (r.json() as Promise<{ url: string }>) : Promise.reject(new Error(String(r.status)))))
      .then(({ url }) => !cancelled && setState({ url: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`, error: false }))
      .catch(() => !cancelled && setState({ url: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [file.id]);

  if (state.error) {
    return (
      <Unavailable
        message={t("officeUnavailable")}
        action={
          <a href={downloadHref(file.id)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 font-semibold text-night hover:bg-white/90">
            <Download className="size-4" aria-hidden /> {t("download")}
          </a>
        }
      />
    );
  }
  if (!state.url) return <Loader2 className="size-8 animate-spin text-white" aria-label={t("loading")} />;
  return (
    <div className="flex size-full max-w-6xl flex-col gap-2">
      <iframe src={state.url} title={file.name} className="min-h-0 w-full flex-1 rounded-lg bg-white shadow-2xl" allowFullScreen />
      <p className="text-center text-xs text-white/60">{t("officeNote")}</p>
    </div>
  );
}

function Unavailable({ message, action }: { message: string; action: ReactNode }) {
  return (
    <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl bg-white/10 p-8 text-center text-white">
      <FileQuestion className="size-10 opacity-80" aria-hidden />
      <p>{message}</p>
      {action}
    </div>
  );
}

/** Bouton « Ouvrir » (ou tout élément cliquable) qui affiche le fichier dans la visionneuse. */
export function OpenFileButton({ file, className, children }: { file: ViewerFile; className?: string; children?: ReactNode }) {
  const t = useTranslations("files");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "text-sm font-medium text-brand-ink hover:underline"}>
        {children ?? t("open")}
      </button>
      <FileViewer file={file} open={open} onOpenChange={setOpen} />
    </>
  );
}
