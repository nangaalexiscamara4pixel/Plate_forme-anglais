import { z } from "zod";

/**
 * Variables d'environnement serveur, validées une seule fois au chargement.
 * Une variable manquante ou invalide fait échouer le démarrage (fail fast)
 * plutôt que de produire un comportement silencieusement non sécurisé.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v : undefined));

const base64Key32 = z.string().refine((v) => Buffer.from(v, "base64").length === 32, {
  message: "doit être une clé de 32 octets encodée en base64",
});

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  /** Connexion directe (sans pool) : migrations et écoute temps réel (LISTEN ne passe pas par PgBouncer). */
  DATABASE_URL_UNPOOLED: optional,
  BETTER_AUTH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: base64Key32,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  ADMIN_NOTIFICATION_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    ),
  RESEND_API_KEY: optional,
  // Envoi par SMTP (ex. Gmail avec un « mot de passe d'application ») : prioritaire sur Resend
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  EMAIL_FROM: z.string().default("GlobeSpeak Academy <no-reply@globespeak.example>"),
  CRON_SECRET: optional,
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
  // Vidéo (Mux) — sans ces clés, les vidéos sont servies localement (démo / développement)
  MUX_TOKEN_ID: optional,
  MUX_TOKEN_SECRET: optional,
  MUX_WEBHOOK_SECRET: optional,
  MUX_SIGNING_KEY_ID: optional,
  MUX_SIGNING_PRIVATE_KEY: optional,
  // Fichiers (Cloudflare R2) — sans ces clés, stockage sur disque local (.dev-storage/)
  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,
  LOCAL_STORAGE_DIR: optional,
  // Vercel Blob (magasin privé relié au projet : jeton ajouté automatiquement par Vercel)
  BLOB_READ_WRITE_TOKEN: optional,
  /** Forcer un pilote de stockage en développement (ex. « blob » pour tester Vercel Blob). */
  STORAGE_DRIVER: optional.pipe(z.enum(["blob", "local"]).optional()),
  // Salle virtuelle (LiveKit) — sans ces clés, la salle fonctionne en mode démo (chat, réactions,
  // mains levées et présence actifs ; vidéo limitée à l'aperçu de sa propre caméra)
  LIVEKIT_URL: optional.pipe(z.string().regex(/^wss?:\/\//, "doit commencer par wss://").optional()),
  LIVEKIT_API_KEY: optional,
  LIVEKIT_API_SECRET: optional,
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Configuration invalide (.env) :\n${issues}`);
}

// En production, l'envoi d'emails est nécessaire (vérification des comptes, mot de passe oublié).
// Sans clé, le site démarre quand même (consultation, connexion de l'administrateur) mais aucun
// email ne part : on le signale clairement dans les journaux plutôt que de bloquer tout le site.
if (
  parsed.data.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !parsed.data.RESEND_API_KEY &&
  !parsed.data.SMTP_USER
) {
  console.error("[config] Ni SMTP ni RESEND_API_KEY : aucun email ne sera envoyé.");
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
