import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { mux, muxEnabled } from "@/server/video";

/**
 * Webhook Mux : la signature est vérifiée (MUX_WEBHOOK_SECRET) avant tout traitement.
 * Met à jour l'état des vidéos (upload → traitement → prête / erreur).
 */
export async function POST(request: Request) {
  if (!muxEnabled) return new NextResponse(null, { status: 404 });
  const body = await request.text();
  let event: { type: string; data: Record<string, unknown> };
  try {
    event = mux().webhooks.unwrap(body, request.headers) as unknown as typeof event;
  } catch {
    logger.warn("webhook Mux rejeté : signature invalide");
    return new NextResponse(null, { status: 400 });
  }

  const data = event.data as {
    id?: string;
    upload_id?: string;
    asset_id?: string;
    duration?: number;
    playback_ids?: { id: string; policy: string }[];
  };
  switch (event.type) {
    case "video.upload.asset_created":
      if (data.id && data.asset_id) {
        await db.video.updateMany({ where: { uploadId: data.id }, data: { assetId: data.asset_id, status: "PROCESSING" } });
      }
      break;
    case "video.asset.ready": {
      const playbackId = data.playback_ids?.find((p) => p.policy === "signed")?.id ?? null;
      await db.video.updateMany({
        where: { OR: [{ assetId: data.id }, ...(data.upload_id ? [{ uploadId: data.upload_id }] : [])] },
        data: { assetId: data.id, playbackId, status: "READY", durationSec: data.duration ? Math.round(data.duration) : null },
      });
      break;
    }
    case "video.asset.errored":
    case "video.upload.errored":
    case "video.upload.cancelled":
      await db.video.updateMany({ where: { OR: [{ assetId: data.id }, { uploadId: data.id }] }, data: { status: "ERRORED" } });
      break;
  }
  return NextResponse.json({ received: true });
}
