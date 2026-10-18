import { NextResponse, type NextRequest } from "next/server";
import { canViewMedia } from "@/features/media/access";
import { db } from "@/server/db";
import { getViewer } from "@/server/dal/viewer";
import { storage, STREAM_URL_TTL_SEC } from "@/server/storage";

/** Documents Office affichables par le lecteur en ligne de Microsoft (PowerPoint, Word, Excel). */
const OFFICE_PREVIEW_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/msword",
  "application/vnd.ms-excel",
]);

const notFound = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });

/** Accès à un fichier : contrôle des droits, puis redirection vers une URL signée de 5 minutes. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) return notFound();
  const media = await db.mediaFile.findUnique({ where: { id } });
  // Réponse identique « inexistant » / « interdit » : on ne révèle pas l'existence d'un fichier.
  if (!media?.uploadedAt || !(await canViewMedia(await getViewer(), { mediaId: id }))) return notFound();

  // Aperçu Office Online : le lecteur de Microsoft doit pouvoir lire le fichier lui-même.
  // On lui confie un lien signé de 30 min, pour ce seul fichier et seulement s'il s'agit d'un document Office.
  if (request.nextUrl.searchParams.get("preview") === "office") {
    if (!OFFICE_PREVIEW_MIMES.has(media.mime) || storage.name === "local") return notFound();
    const signed = await storage.presignDownload(media.key, { mime: media.mime, filename: media.originalName ?? undefined, ttlSec: 30 * 60 });
    return NextResponse.json({ url: signed }, { headers: { "Cache-Control": "no-store" } });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const url = await storage.presignDownload(media.key, {
    mime: media.mime,
    inline: !download,
    filename: media.originalName ?? undefined,
    ttlSec: !download && /^(audio|video)\//.test(media.mime) ? STREAM_URL_TTL_SEC : undefined,
  });
  return NextResponse.redirect(new URL(url, request.url), { status: 302, headers: { "Cache-Control": "no-store" } });
}
