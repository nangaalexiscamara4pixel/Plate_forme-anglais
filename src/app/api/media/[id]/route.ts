import { NextResponse, type NextRequest } from "next/server";
import { canViewMedia } from "@/features/media/access";
import { db } from "@/server/db";
import { getViewer } from "@/server/dal/viewer";
import { storage } from "@/server/storage";

const notFound = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });

/** Accès à un fichier : contrôle des droits, puis redirection vers une URL signée de 5 minutes. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) return notFound();
  const media = await db.mediaFile.findUnique({ where: { id } });
  // Réponse identique « inexistant » / « interdit » : on ne révèle pas l'existence d'un fichier.
  if (!media?.uploadedAt || !(await canViewMedia(await getViewer(), { mediaId: id }))) return notFound();

  const download = request.nextUrl.searchParams.get("download") === "1";
  const url = await storage.presignDownload(media.key, {
    mime: media.mime,
    inline: !download,
    filename: media.originalName ?? undefined,
  });
  return NextResponse.redirect(new URL(url, request.url), { status: 302, headers: { "Cache-Control": "no-store" } });
}
