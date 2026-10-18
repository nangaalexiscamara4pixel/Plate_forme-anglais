/** Types de fichiers acceptés par les sélecteurs (extensions incluses : les types Office manquent souvent sous Windows). */
export const ACCEPT = {
  image: "image/png,image/jpeg,image/webp,image/avif,image/gif",
  document: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf",
  documentOrImage: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf,image/png,image/jpeg,image/webp,image/avif,image/gif",
  audio: "audio/*",
  video: "video/mp4,video/webm",
  /** Documents, images, vidéos et audio (consignes de devoirs, pièces jointes de questions) */
  any: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf,image/png,image/jpeg,image/webp,image/avif,image/gif,video/mp4,video/webm,audio/*",
} as const;

export type FileKind = "image" | "video" | "pdf" | "slides" | "sheet" | "word" | "audio" | "other";

/** Famille d'un fichier d'après son type (icône, libellé). */
export function fileKind(mime: string): FileKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "slides";
  if (mime.includes("sheet") || mime.includes("excel")) return "sheet";
  if (mime.includes("word")) return "word";
  return "other";
}
