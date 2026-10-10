import type { NextConfig } from "next";

/** En-têtes de sécurité appliqués à toutes les réponses (la CSP à nonce est posée par src/proxy.ts). */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Le micro est autorisé sur notre origine (exercices Speaking) ; tout le reste est désactivé.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // Application authentifiée et personnalisée : rendu dynamique par défaut, sans
  // Cache Components, pour éviter tout risque de mise en cache de données par utilisateur.
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "pino"],
  turbopack: {
    // Équivalent de createNextIntlPlugin() : le plugin charge @swc/core (binaire natif)
    // uniquement pour des fonctions expérimentales que nous n'utilisons pas.
    resolveAlias: { "next-intl/config": "./src/i18n/request.ts" },
    // Tailwind passe par PostCSS (postcss.config.mjs) : le chargeur @tailwindcss/turbopack ne
    // suivait pas les fichiers source et ne régénérait pas le CSS en développement.
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
