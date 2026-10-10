import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Applique les migrations sur la base de test avant l'exécution de la suite. */
export default function setup() {
  const devEnv: Record<string, string> = {};
  config({ path: ".env", processEnv: devEnv, quiet: true });
  const env = { ...process.env };
  config({ path: ".env.test", override: true, processEnv: env as Record<string, string>, quiet: true });

  // Garde-fou : la suite vide les tables, elle ne doit jamais viser la base de développement.
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL manquante dans .env.test");
  if (env.DATABASE_URL === devEnv.DATABASE_URL) {
    throw new Error(".env.test pointe vers la base de développement : utilisez une base dédiée (npm run db:test:start)");
  }
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
}
