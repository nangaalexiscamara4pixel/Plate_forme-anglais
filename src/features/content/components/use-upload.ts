"use client";

import { useCallback, useState } from "react";
import type { UploadPurpose } from "@/features/media/policy";
import { confirmUploadAction, requestUploadAction } from "../actions";

export type UploadState = { status: "idle" } | { status: "uploading"; progress: number } | { status: "error"; error: string };

/**
 * Upload direct navigateur → stockage (URL signée), avec progression,
 * puis confirmation serveur (taille et signature binaire vérifiées).
 */
export function useUpload(purpose: Exclude<UploadPurpose, "SUBMISSION_AUDIO">) {
  const [state, setState] = useState<UploadState>({ status: "idle" });

  const upload = useCallback(
    async (file: File): Promise<{ id: string; name: string; mime: string } | null> => {
      setState({ status: "uploading", progress: 0 });
      const req = await requestUploadAction(null, { purpose, mime: file.type, size: file.size, name: file.name });
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
      const confirmed = await confirmUploadAction(null, { mediaId });
      if (!confirmed.ok || !confirmed.data) {
        setState({ status: "error", error: confirmed.ok ? "generic" : confirmed.error });
        return null;
      }
      setState({ status: "idle" });
      return confirmed.data;
    },
    [purpose],
  );

  return { state, upload, reset: () => setState({ status: "idle" }) };
}
