import { randomUUID } from "node:crypto";
import { audit, type AuditContext } from "@/server/audit";
import { db } from "@/server/db";
import { storage, type PresignedUpload } from "@/server/storage";
import { createMuxDirectUpload, muxEnabled } from "@/server/video";
import { parseChapters, parseSubtitles } from "@/features/video/captions";
import { extensionFor, matchesSignature, MEDIA_POLICY, type UploadPurpose } from "./policy";

/**
 * Médiathèque du CMS et enregistrements d'étudiants (l'appelant vérifie le rôle et la propriété).
 * Upload en deux temps : URL signée → envoi direct par le navigateur → confirmation
 * serveur (taille + signature binaire). Un fichier non confirmé n'est jamais servi.
 */

export class MediaError extends Error {
  constructor(public readonly code: "TYPE_NOT_ALLOWED" | "TOO_LARGE" | "NOT_FOUND" | "UPLOAD_MISMATCH" | "MUX_DISABLED") {
    super(code);
  }
}

export async function requestUpload(
  actor: AuditContext,
  input: { purpose: UploadPurpose; mime: string; size: number; name: string; ownerUserId?: string },
): Promise<{ mediaId: string; upload: PresignedUpload }> {
  const policy = MEDIA_POLICY[input.purpose];
  if (!(policy.mimes as readonly string[]).includes(input.mime)) throw new MediaError("TYPE_NOT_ALLOWED");
  if (input.size <= 0 || input.size > policy.maxBytes) throw new MediaError("TOO_LARGE");

  const now = new Date();
  // Clé aléatoire, sans le nom d'origine (pas de donnée utilisateur dans les chemins).
  const key = `${input.purpose.toLowerCase()}/${now.getUTCFullYear()}/${randomUUID()}.${extensionFor(input.mime)}`;
  const media = await db.mediaFile.create({
    data: {
      key,
      mime: input.mime,
      sizeBytes: input.size,
      originalName: input.name.slice(0, 200),
      purpose: input.purpose,
      uploadedById: actor.actorId,
      ownerUserId: input.ownerUserId ?? null,
    },
  });
  return { mediaId: media.id, upload: await storage.presignUpload(key, input.mime, input.size) };
}

export async function confirmUpload(actor: AuditContext, mediaId: string) {
  const media = await db.mediaFile.findUnique({ where: { id: mediaId } });
  if (!media) throw new MediaError("NOT_FOUND");
  if (media.uploadedAt) return media;
  const head = await storage.head(media.key);
  const start = head ? await storage.readStart(media.key, 16) : Buffer.alloc(0);
  if (!head || head.size !== media.sizeBytes || !matchesSignature(media.mime, start)) {
    await storage.remove(media.key).catch(() => null);
    await db.mediaFile.delete({ where: { id: media.id } });
    throw new MediaError("UPLOAD_MISMATCH");
  }
  const confirmed = await db.mediaFile.update({ where: { id: media.id }, data: { uploadedAt: new Date() } });
  await audit(actor, "media.upload", { type: "media", id: media.id }, { purpose: media.purpose, size: media.sizeBytes });
  return confirmed;
}

// ── Vidéos ───────────────────────────────────────────────────────────────────

/** Vidéo locale : le fichier (déjà confirmé) devient une vidéo prête à être utilisée. */
export async function createLocalVideo(actor: AuditContext, input: { mediaId: string; title: string }) {
  const media = await db.mediaFile.findUnique({ where: { id: input.mediaId } });
  if (!media?.uploadedAt || media.purpose !== "LESSON_VIDEO") throw new MediaError("NOT_FOUND");
  const video = await db.video.create({
    data: { title: input.title, provider: "LOCAL", status: "READY", mediaFileId: media.id },
  });
  await audit(actor, "video.update", { type: "video", id: video.id }, { op: "create", provider: "LOCAL" });
  return video;
}

/** Vidéo Mux : crée l'upload direct ; le webhook Mux passera la vidéo à READY. */
export async function createMuxVideo(actor: AuditContext, input: { title: string; origin: string }) {
  if (!muxEnabled) throw new MediaError("MUX_DISABLED");
  const upload = await createMuxDirectUpload(input.origin);
  const video = await db.video.create({
    data: { title: input.title, provider: "MUX", status: "UPLOADING", uploadId: upload.id },
  });
  await audit(actor, "video.update", { type: "video", id: video.id }, { op: "create", provider: "MUX" });
  return { videoId: video.id, uploadUrl: upload.url };
}

export async function updateVideoDetails(
  actor: AuditContext,
  videoId: string,
  input: { title: string; chapters: string; subtitlesEn: string; subtitlesFr: string },
) {
  const video = await db.video.findUnique({ where: { id: videoId }, select: { id: true } });
  if (!video) throw new MediaError("NOT_FOUND");
  const chapters = parseChapters(input.chapters);
  const tracks = [
    { lang: "en", cues: parseSubtitles(input.subtitlesEn) },
    { lang: "fr", cues: parseSubtitles(input.subtitlesFr) },
  ];
  await db.$transaction([
    db.video.update({ where: { id: videoId }, data: { title: input.title, chapters } }),
    ...tracks.map((t) =>
      t.cues.length
        ? db.videoTrack.upsert({
            where: { videoId_lang_kind: { videoId, lang: t.lang, kind: "SUBTITLES" } },
            create: { videoId, lang: t.lang, kind: "SUBTITLES", cues: t.cues },
            update: { cues: t.cues },
          })
        : db.videoTrack.deleteMany({ where: { videoId, lang: t.lang, kind: "SUBTITLES" } }),
    ),
  ]);
  await audit(actor, "video.update", { type: "video", id: videoId }, {
    op: "details",
    chapters: chapters.length,
    en: tracks[0]!.cues.length,
    fr: tracks[1]!.cues.length,
  });
  return { chapters: chapters.length, en: tracks[0]!.cues.length, fr: tracks[1]!.cues.length };
}

/** Suppression d'un fichier — refusée s'il est encore utilisé par un bloc de leçon. */
export async function deleteMedia(actor: AuditContext, mediaId: string) {
  const media = await db.mediaFile.findUnique({ where: { id: mediaId }, include: { videos: { select: { id: true } } } });
  if (!media) throw new MediaError("NOT_FOUND");
  const usedByBlock = await db.lessonBlock.count({ where: { content: { path: ["mediaId"], equals: mediaId } } });
  const usedByVideo = media.videos.length
    ? await db.lessonBlock.count({ where: { videoId: { in: media.videos.map((v) => v.id) } } })
    : 0;
  if (usedByBlock + usedByVideo > 0) return { deleted: false as const, usage: usedByBlock + usedByVideo };
  await db.$transaction([
    db.video.deleteMany({ where: { mediaFileId: media.id } }),
    db.mediaFile.delete({ where: { id: media.id } }),
  ]);
  await storage.remove(media.key).catch(() => null);
  await audit(actor, "media.delete", { type: "media", id: mediaId });
  return { deleted: true as const };
}
