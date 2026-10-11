/**
 * Types et tailles de fichiers acceptés par usage. Le type annoncé par le navigateur est
 * vérifié une seconde fois après l'upload grâce à la signature binaire (« magic bytes »).
 * Le SVG est volontairement exclu des images (il peut contenir du script).
 */
const MB = 1024 * 1024;

export const MEDIA_POLICY = {
  LESSON_VIDEO: { maxBytes: 1024 * MB, mimes: ["video/mp4", "video/webm"] },
  LESSON_AUDIO: { maxBytes: 50 * MB, mimes: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav"] },
  LESSON_IMAGE: { maxBytes: 10 * MB, mimes: ["image/jpeg", "image/png", "image/webp", "image/avif"] },
  LESSON_DOCUMENT: { maxBytes: 25 * MB, mimes: ["application/pdf"] },
  // Enregistrements des étudiants (devoirs d'expression orale), produits par le navigateur
  SUBMISSION_AUDIO: { maxBytes: 20 * MB, mimes: ["audio/webm", "audio/ogg", "audio/mp4"] },
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
};

export function extensionFor(mime: string): string {
  return EXT[mime] ?? "bin";
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
    default:
      return false;
  }
}
