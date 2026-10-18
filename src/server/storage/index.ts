import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, open, rm, stat } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as blob from "@vercel/blob";
import { env } from "@/env";

/**
 * Stockage de fichiers privés.
 *  - Production : Cloudflare R2 (API S3) ou Vercel Blob en mode privé, URLs pré-signées de courte durée.
 *  - Développement / tests : disque local (`.dev-storage/`), servi par /api/storage avec des jetons
 *    HMAC expirants — même modèle de sécurité que les URLs pré-signées.
 * Aucune URL permanente n'est jamais exposée.
 */

export const UPLOAD_URL_TTL_SEC = 10 * 60;
export const DOWNLOAD_URL_TTL_SEC = 5 * 60;

export type PresignedUpload = { url: string; method: "PUT"; headers: Record<string, string> };

export interface StorageDriver {
  readonly name: "r2" | "blob" | "local";
  presignUpload(key: string, mime: string, size: number): Promise<PresignedUpload>;
  presignDownload(key: string, opts?: { filename?: string; inline?: boolean; mime?: string }): Promise<string>;
  head(key: string): Promise<{ size: number } | null>;
  /** Premiers octets d'un objet (contrôle de la signature binaire après upload). */
  readStart(key: string, bytes: number): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

// ── Cloudflare R2 ────────────────────────────────────────────────────────────

class R2Driver implements StorageDriver {
  readonly name = "r2" as const;
  private client: S3Client;
  constructor(private bucket: string) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
    });
  }
  async presignUpload(key: string, mime: string, size: number): Promise<PresignedUpload> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mime, ContentLength: size }),
      { expiresIn: UPLOAD_URL_TTL_SEC },
    );
    return { url, method: "PUT", headers: { "Content-Type": mime } };
  }
  presignDownload(key: string, opts: { filename?: string; inline?: boolean; mime?: string } = {}) {
    const disposition = `${opts.inline === false ? "attachment" : "inline"}${opts.filename ? `; filename="${encodeURIComponent(opts.filename)}"` : ""}`;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: disposition }),
      { expiresIn: DOWNLOAD_URL_TTL_SEC },
    );
  }
  async head(key: string) {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: Number(res.ContentLength ?? 0) };
    } catch {
      return null;
    }
  }
  async readStart(key: string, bytes: number) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

// ── Vercel Blob (stockage privé) ─────────────────────────────────────────────

/**
 * Magasin Vercel Blob en accès PRIVÉ : sans signature, tout accès est refusé (403). Envoi et
 * lecture passent par des URLs pré-signées limitées à un fichier, une opération et une durée.
 */
class VercelBlobDriver implements StorageDriver {
  readonly name = "blob" as const;
  constructor(private token: string) {}
  async presignUpload(key: string, mime: string, size: number): Promise<PresignedUpload> {
    const validUntil = Date.now() + UPLOAD_URL_TTL_SEC * 1000;
    const signed = await blob.issueSignedToken({ token: this.token, pathname: key, operations: ["put"], allowedContentTypes: [mime], maximumSizeInBytes: size, validUntil });
    const { presignedUrl } = await blob.presignUrl(signed, {
      operation: "put",
      pathname: key,
      access: "private",
      allowedContentTypes: [mime],
      maximumSizeInBytes: size,
      addRandomSuffix: false,
      allowOverwrite: false,
      validUntil,
    });
    return { url: presignedUrl, method: "PUT", headers: { "Content-Type": mime } };
  }
  async presignDownload(key: string) {
    const validUntil = Date.now() + DOWNLOAD_URL_TTL_SEC * 1000;
    const signed = await blob.issueSignedToken({ token: this.token, pathname: key, operations: ["get"], validUntil });
    return (await blob.presignUrl(signed, { operation: "get", pathname: key, access: "private", validUntil })).presignedUrl;
  }
  async head(key: string) {
    try {
      return { size: (await blob.head(key, { token: this.token })).size };
    } catch {
      return null;
    }
  }
  async readStart(key: string, bytes: number) {
    const res = await blob.get(key, { token: this.token, access: "private", useCache: false });
    if (!res?.stream) return Buffer.alloc(0);
    const reader = res.stream.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      while (total < bytes) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
        total += value.length;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return Buffer.concat(chunks).subarray(0, bytes);
  }
  async remove(key: string) {
    await blob.del(key, { token: this.token });
  }
}

// ── Disque local (développement) ─────────────────────────────────────────────

// Pilote de développement uniquement : on indique à Turbopack de ne pas tracer ces accès disque dynamiques.
export const LOCAL_STORAGE_ROOT = path.resolve(/*turbopackIgnore: true*/ env.LOCAL_STORAGE_DIR ?? ".dev-storage");
const signingKey = createHmac("sha256", Buffer.from(env.ENCRYPTION_KEY, "base64")).update("local-storage").digest();

export type LocalToken = { k: string; op: "get" | "put"; exp: number; mime?: string; size?: number; fn?: string; inline?: boolean };

export function signLocalToken(payload: LocalToken): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", signingKey).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyLocalToken(token: string): LocalToken | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signingKey).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as LocalToken;
  return payload.exp > Date.now() ? payload : null;
}

/** Chemin disque d'une clé — refuse toute tentative de sortie du dossier (path traversal). */
export function localPath(key: string): string {
  const full = path.resolve(LOCAL_STORAGE_ROOT, key);
  if (!full.startsWith(LOCAL_STORAGE_ROOT + path.sep)) throw new Error("Clé de stockage invalide");
  return full;
}

class LocalDriver implements StorageDriver {
  readonly name = "local" as const;
  async presignUpload(key: string, mime: string, size: number): Promise<PresignedUpload> {
    await mkdir(path.dirname(localPath(key)), { recursive: true });
    const token = signLocalToken({ k: key, op: "put", exp: Date.now() + UPLOAD_URL_TTL_SEC * 1000, mime, size });
    return { url: `/api/storage?t=${token}`, method: "PUT", headers: { "Content-Type": mime } };
  }
  async presignDownload(key: string, opts: { filename?: string; inline?: boolean; mime?: string } = {}) {
    const token = signLocalToken({
      k: key,
      op: "get",
      exp: Date.now() + DOWNLOAD_URL_TTL_SEC * 1000,
      fn: opts.filename,
      inline: opts.inline,
      mime: opts.mime,
    });
    return `/api/storage?t=${token}`;
  }
  async head(key: string) {
    try {
      return { size: (await stat(/*turbopackIgnore: true*/ localPath(key))).size };
    } catch {
      return null;
    }
  }
  async readStart(key: string, bytes: number) {
    const handle = await open(/*turbopackIgnore: true*/ localPath(key), "r");
    try {
      const buf = Buffer.alloc(bytes);
      const { bytesRead } = await handle.read(buf, 0, bytes, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }
  async remove(key: string) {
    await rm(localPath(key), { force: true });
  }
}

/** R2 s'il est configuré ; sinon Vercel Blob en production (ou si STORAGE_DRIVER=blob) ; sinon disque local. */
export const storage: StorageDriver =
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET
    ? new R2Driver(env.R2_BUCKET)
    : env.BLOB_READ_WRITE_TOKEN && (env.NODE_ENV === "production" || env.STORAGE_DRIVER === "blob")
      ? new VercelBlobDriver(env.BLOB_READ_WRITE_TOKEN)
      : new LocalDriver();
