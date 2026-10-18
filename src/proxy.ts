import { getSessionCookie } from "better-auth/cookies";
import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

/**
 * Proxy (ex-middleware) — PREMIER filtre uniquement :
 *  1. génère un nonce CSP par requête ;
 *  2. redirige vers la connexion si l'espace privé est demandé sans cookie de session ;
 *  3. résout la langue (next-intl).
 * Il ne remplace PAS les contrôles d'accès : chaque page, Server Action et route API
 * revérifie la session, le statut, le rôle et le niveau côté serveur (src/server/dal).
 */
const intl = createIntlMiddleware(routing);

const PRIVATE_PREFIXES = ["/app", "/admin", "/room"];
const localePattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

/** Serveur LiveKit (salle virtuelle) : LiveKit Cloud, ou l'hôte de LIVEKIT_URL s'il est auto-hébergé. */
function liveKitSources() {
  const sources = ["wss://*.livekit.cloud", "https://*.livekit.cloud"];
  try {
    if (process.env.LIVEKIT_URL) {
      const url = new URL(process.env.LIVEKIT_URL);
      sources.push(`${url.protocol}//${url.host}`, `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`);
    }
  } catch {
    // URL invalide : refusée au démarrage par src/env.ts
  }
  return sources.join(" ");
}

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Les attributs style (Tailwind/Motion) nécessitent 'unsafe-inline' pour les styles uniquement.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://image.mux.com https://*.r2.cloudflarestorage.com https://*.blob.vercel-storage.com",
    "font-src 'self'",
    "media-src 'self' blob: https://stream.mux.com https://*.r2.cloudflarestorage.com https://*.blob.vercel-storage.com",
    // Mux (lecture, statistiques, upload direct via Google Cloud Storage) et R2 (uploads pré-signés)
    `connect-src 'self' https://*.mux.com https://*.litix.io https://storage.googleapis.com https://*.r2.cloudflarestorage.com https://vercel.com https://*.blob.vercel-storage.com ${liveKitSources()}`,
    "worker-src 'self' blob:",
    // PDF affichés dans la visionneuse du site (copie locale blob:), jamais de site tiers
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(localePattern);
  const pathWithoutLocale = localeMatch ? pathname.slice(localeMatch[0].length) || "/" : pathname;

  const isPrivate = PRIVATE_PREFIXES.some((p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`));
  if (isPrivate && !getSessionCookie(request, { cookiePrefix: "gs" })) {
    const prefix = localeMatch ? localeMatch[0] : "";
    const url = new URL(`${prefix}/sign-in`, request.url);
    url.searchParams.set("next", pathWithoutLocale);
    const res = NextResponse.redirect(url);
    res.headers.set("Content-Security-Policy", csp);
    return res;
  }

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = intl(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icons|images|manifest.webmanifest|robots.txt|sitemap.xml|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
