import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { NextResponse, type NextRequest } from "next/server";
import { localPath, storage, verifyLocalToken } from "@/server/storage";

/**
 * Pilote de stockage LOCAL (développement) — équivalent des URLs pré-signées R2.
 * Chaque requête doit porter un jeton HMAC expirant, lié à une clé et à une opération.
 * En production (R2 configuré), cette route est désactivée.
 */
function deny(status = 404) {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  if (storage.name !== "local") return deny();
  const token = verifyLocalToken(request.nextUrl.searchParams.get("t") ?? "");
  if (!token || token.op !== "put" || !request.body) return deny(403);
  if (token.mime && request.headers.get("content-type") !== token.mime) return deny(415);

  const limit = token.size ?? 0;
  const target = localPath(token.k);
  const tmp = `${target}.part`;
  await mkdir(path.dirname(target), { recursive: true });
  let written = 0;
  const guard = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      written += chunk.length;
      // La taille annoncée lors de la demande d'upload est un plafond strict.
      cb(written > limit ? new Error("too large") : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(request.body as unknown as WebReadableStream), guard, createWriteStream(tmp));
  } catch {
    await rm(tmp, { force: true });
    return deny(413);
  }
  await rename(tmp, target);
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  if (storage.name !== "local") return deny();
  const token = verifyLocalToken(request.nextUrl.searchParams.get("t") ?? "");
  if (!token || token.op !== "get") return deny(403);

  const file = localPath(token.k);
  const info = await stat(file).catch(() => null);
  if (!info) return deny();

  const headers = new Headers({
    "Content-Type": token.mime ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${token.inline === false ? "attachment" : "inline"}${token.fn ? `; filename*=UTF-8''${encodeURIComponent(token.fn)}` : ""}`,
  });

  // Requêtes partielles (Range) : indispensables pour la lecture et la navigation dans les vidéos.
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start >= info.size || start > end) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new NextResponse(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status: 206, headers });
  }
  headers.set("Content-Length", String(info.size));
  return new NextResponse(Readable.toWeb(createReadStream(file)) as ReadableStream, { status: 200, headers });
}
