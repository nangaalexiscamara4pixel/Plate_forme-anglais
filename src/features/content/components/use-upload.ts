"use client";

import { useCallback, useState } from "react";
import { mimeFromName, type UploadPurpose } from "@/features/media/policy";
import type { ActionResult } from "@/server/actions";
import type { PresignedUpload } from "@/server/storage";
import { confirmUploadAction, requestUploadAction } from "../actions";

export type UploadState = { status: "idle" } | { status: "uploading"; progress: number } | { status: "error"; error: string };
export type UploadedFile = { id: string; name: string; mime: string };

/** Circuit d'envoi : demande d'URL signée puis confirmation (administrateur ou étudiant). */
export type Uploader = {
  request: (file: { mime: string; size: number; name: string }) => Promise<ActionResult<{ mediaId: string; upload: PresignedUpload }>>;
  confirm: (mediaId: string) => Promise<ActionResult<UploadedFile>>;
};

type AdminPurpose = Exclude<UploadPurpose, "SUBMISSION_AUDIO" | "SUBMISSION_FILE">;

/** Médiathèque de l'enseignant (fichiers de cours). */
export function adminUploader(purpose: AdminPurpose): Uploader {
  return {
    request: (file) => requestUploadAction(null, { purpose, ...file }),
    confirm: (mediaId) => confirmUploadAction(null, { mediaId }),
  };
}

/** Médiathèque de l'enseignant, type choisi d'après le fichier (image, audio ou document). */
export const adminAutoUploader: Uploader = {
  request: (file) =>
    requestUploadAction(null, {
      purpose: file.mime.startsWith("image/")
        ? "LESSON_IMAGE"
        : file.mime.startsWith("audio/")
          ? "LESSON_AUDIO"
          : file.mime.startsWith("video/")
            ? "LESSON_VIDEO"
            : "LESSON_DOCUMENT",
      ...file,
    }),
  confirm: (mediaId) => confirmUploadAction(null, { mediaId }),
};

/**
 * Upload direct navigateur → stockage (URL signée), avec progression,
 * puis confirmation serveur (taille et signature binaire vérifiées).
 */
export function useUpload(source: AdminPurpose | Uploader) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const uploader = typeof source === "string" ? adminUploader(source) : source;
  const key = typeof source === "string" ? source : source;

  const upload = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      setState({ status: "uploading", progress: 0 });
      // Sous Windows, le navigateur ne fournit souvent pas le type des fichiers Office.
      const mime = file.type || mimeFromName(file.name) || "application/octet-stream";
      const req = await uploader.request({ mime, size: file.size, name: file.name || "capture.png" });
      if (!req.ok || !req.data) {
        setState({ status: "error", error: req.ok ? "generic" : req.error });
        return null;
      }
      const { mediaId, upload: target } = req.data;
      const ok = await new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open(target.method, target.url);
        for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v);
        xhr.upload.onprogress = (e) => e.lengthComputable && setState({ status: "uploading", progress: Math.round((e.loaded / e.total) * 100) });
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
        xhr.onerror = () => resolve(false);
        xhr.send(file);
      });
      if (!ok) {
        setState({ status: "error", error: "UPLOAD_FAILED" });
        return null;
      }
      const confirmed = await uploader.confirm(mediaId);
      if (!confirmed.ok || !confirmed.data) {
        setState({ status: "error", error: confirmed.ok ? "generic" : confirmed.error });
        return null;
      }
      setState({ status: "idle" });
      return confirmed.data;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- l'uploader est recréé à chaque rendu ; seule sa source compte
    [key],
  );

  return { state, upload, reset: () => setState({ status: "idle" }) };
}
