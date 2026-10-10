import { NextResponse } from "next/server";
import { toWebVtt, type Cue } from "@/features/video/captions";
import { canViewMedia } from "@/features/media/access";
import { db } from "@/server/db";
import { getViewer } from "@/server/dal/viewer";

/** Sous-titres WebVTT d'une vidéo (anglais / français), soumis aux mêmes droits que la vidéo. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; lang: string }> }) {
  const { id, lang } = await params;
  const notFound = new NextResponse(null, { status: 404 });
  if (!/^[\w-]{1,64}$/.test(id) || !["en", "fr"].includes(lang)) return notFound;
  if (!(await canViewMedia(await getViewer(), { videoId: id }))) return notFound;
  const track = await db.videoTrack.findUnique({ where: { videoId_lang_kind: { videoId: id, lang, kind: "SUBTITLES" } } });
  if (!track) return notFound;
  return new NextResponse(toWebVtt(track.cues as Cue[]), {
    headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
}
