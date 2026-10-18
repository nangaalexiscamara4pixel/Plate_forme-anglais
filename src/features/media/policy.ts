/**
 * Types et tailles de fichiers acceptés par usage. Le type annoncé par le navigateur est
 * vérifié une seconde fois après l'upload grâce à la signature binaire (« magic bytes »).
 * Le SVG est volontairement exclu des images (il peut contenir du script).
 */
const MB = 1024 * 1024;

/** Documents de cours et rendus d'étudiants : PDF, Word, PowerPoint, Excel (formats récents et anciens). */
export const OFFICE_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.ms-excel",
] as const;
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"] as const;

export const MEDIA_POLICY = {
  // 500 Mo : limite d'un envoi direct en une fois vers le stockage
  LESSON_VIDEO: { maxBytes: 500 * MB, mimes: ["video/mp4", "video/webm"] },
  LESSON_AUDIO: { maxBytes: 50 * MB, mimes: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav"] },
  LESSON_IMAGE: { maxBytes: 15 * MB, mimes: IMAGE_MIMES },
  LESSON_DOCUMENT: { maxBytes: 100 * MB, mimes: OFFICE_MIMES },
  // Enregistrements des étudiants (devoirs d'expression orale), produits par le navigateur
  SUBMISSION_AUDIO: { maxBytes: 20 * MB, mimes: ["audio/webm", "audio/ogg", "audio/mp4"] },
  // Copie rendue par un étudiant : document ou photo/capture de son travail
  SUBMISSION_FILE: { maxBytes: 25 * MB, mimes: [...OFFICE_MIMES, ...IMAGE_MIMES] },
} as const;

export type UploadPurpose = keyof typeof MEDIA_POLICY;

const EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/webm": "weba",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
  "image/gif": "gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/msword": "doc",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.ms-excel": "xls",
};

export function extensionFor(mime: string): string {
  return EXT[mime] ?? "bin";
}

/** Type déduit de l'extension, quand le navigateur n'en fournit pas (fréquent pour Office sous Windows). */
export function mimeFromName(name: string): string | undefined {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "jpeg") return "image/jpeg";
  if (ext === "mp3") return "audio/mpeg";
  return Object.entries(EXT).find(([, e]) => e === ext)?.[0];
}

/** Nom de fichier sûr pour les chemins de stockage (lettres, chiffres, tirets), sans extension. */
export function safeBaseName(name: string): string {
  // Extension retirée seulement si elle termine le nom (pas de « / » ou « \ » après le point)
  const base = name
    .replace(/\.[^./\\]*$/, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  return base.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "fichier";
}

/** Vérifie que les premiers octets correspondent bien au type déclaré. */
export function matchesSignature(mime: string, head: Buffer): boolean {
  const ascii = (start: number, s: string) => head.subarray(start, start + s.length).toString("latin1") === s;
  const bytes = (start: number, ...b: number[]) => b.every((v, i) => head[start + i] === v);
  switch (mime) {
    case "video/mp4":
    case "audio/mp4":
    case "audio/x-m4a":
    case "image/avif":
      return ascii(4, "ftyp");
    case "video/webm":
    case "audio/webm":
      return bytes(0, 0x1a, 0x45, 0xdf, 0xa3);
    case "audio/mpeg":
      return ascii(0, "ID3") || (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0);
    case "audio/ogg":
      return ascii(0, "OggS");
    case "audio/wav":
    case "audio/x-wav":
      return ascii(0, "RIFF") && ascii(8, "WAVE");
    case "image/jpeg":
      return bytes(0, 0xff, 0xd8, 0xff);
    case "image/png":
      return bytes(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "application/pdf":
      return ascii(0, "%PDF-");
    case "image/gif":
      return ascii(0, "GIF8");
    // Office récent (docx, pptx, xlsx) : archive ZIP
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return bytes(0, 0x50, 0x4b, 0x03, 0x04);
    // Office ancien (doc, ppt, xls) : conteneur OLE
    case "application/msword":
    case "application/vnd.ms-powerpoint":
    case "application/vnd.ms-excel":
      return bytes(0, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    default:
      return false;
  }
}
