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

const PRIVATE_PREFIXES = ["/app", "/admin"];
const localePattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Les attributs style (Tailwind/Motion) nécessitent 'unsafe-inline' pour les styles uniquement.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://image.mux.com",
    "font-src 'self'",
    "media-src 'self' blob: https://stream.mux.com",
    "connect-src 'self' https://*.mux.com https://*.litix.io",
    "worker-src 'self' blob:",
    "frame-src 'none'",
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
