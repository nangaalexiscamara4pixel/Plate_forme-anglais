import { NextResponse, type NextRequest } from "next/server";
import { canViewMedia } from "@/features/media/access";
import { db } from "@/server/db";
import { getViewer } from "@/server/dal/viewer";
import { storage } from "@/server/storage";

/** Lecture d'une vidéo LOCALE : contrôle des droits puis URL signée de courte durée. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = /^[\w-]{1,64}$/.test(id)
    ? await db.video.findUnique({ where: { id }, include: { mediaFile: true } })
    : null;
  if (!video?.mediaFile?.uploadedAt || !(await canViewMedia(await getViewer(), { videoId: id }))) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const url = await storage.presignDownload(video.mediaFile.key, { mime: video.mediaFile.mime, inline: true });
  return NextResponse.redirect(new URL(url, request.url), { status: 302, headers: { "Cache-Control": "no-store" } });
}
