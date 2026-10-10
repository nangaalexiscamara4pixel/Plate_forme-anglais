import Mux from "@mux/mux-node";
import { env } from "@/env";

/**
 * Fournisseur vidéo.
 *  - Mux (production) : upload direct depuis le navigateur, politique de lecture SIGNÉE,
 *    aucun MP4 téléchargeable ; un jeton JWT court est émis à chaque affichage, après
 *    vérification des droits d'accès.
 *  - Local (développement) : fichier servi par /api/video/[id]/stream après la même vérification.
 */
export const muxEnabled = Boolean(env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET);

let client: Mux | null = null;
export function mux(): Mux {
  if (!muxEnabled) throw new Error("Mux n'est pas configuré");
  client ??= new Mux({
    tokenId: env.MUX_TOKEN_ID!,
    tokenSecret: env.MUX_TOKEN_SECRET!,
    webhookSecret: env.MUX_WEBHOOK_SECRET,
    jwtSigningKey: env.MUX_SIGNING_KEY_ID,
    jwtPrivateKey: env.MUX_SIGNING_PRIVATE_KEY,
  });
  return client;
}

/** Durée de validité d'un jeton de lecture : la séance la plus longue raisonnable. */
const PLAYBACK_TTL = "4h";

export async function createMuxDirectUpload(origin: string) {
  return mux().video.uploads.create({
    cors_origin: origin,
    new_asset_settings: { playback_policy: ["signed"], video_quality: "plus", static_renditions: [] },
  });
}

export async function muxPlaybackTokens(playbackId: string) {
  const m = mux();
  const [playback, thumbnail, storyboard] = await Promise.all([
    m.jwt.signPlaybackId(playbackId, { type: "video", expiration: PLAYBACK_TTL }),
    m.jwt.signPlaybackId(playbackId, { type: "thumbnail", expiration: PLAYBACK_TTL }),
    m.jwt.signPlaybackId(playbackId, { type: "storyboard", expiration: PLAYBACK_TTL }),
  ]);
  return { playback, thumbnail, storyboard };
}

export type PlaybackSource =
  | { kind: "mux"; playbackId: string; tokens: { playback: string; thumbnail: string; storyboard: string } }
  | { kind: "file"; src: string }
  | { kind: "unavailable" };

/** Source de lecture d'une vidéo — à n'appeler qu'APRÈS avoir vérifié l'accès du spectateur. */
export async function playbackSource(video: {
  id: string;
  provider: string;
  playbackId: string | null;
  status: string;
  mediaFileId: string | null;
}): Promise<PlaybackSource> {
  if (video.status !== "READY") return { kind: "unavailable" };
  if (video.provider === "MUX" && video.playbackId && muxEnabled) {
    return { kind: "mux", playbackId: video.playbackId, tokens: await muxPlaybackTokens(video.playbackId) };
  }
  if (video.provider === "LOCAL" && video.mediaFileId) return { kind: "file", src: `/api/video/${video.id}/stream` };
  return { kind: "unavailable" };
}
