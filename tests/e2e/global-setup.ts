import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { config } from "dotenv";
import pg from "pg";

/** Base de test vierge + seed (niveaux et administrateur) avant la suite E2E. */
export default async function globalSetup() {
  const env = { ...process.env };
  config({ path: ".env.test", override: true, processEnv: env as Record<string, string>, quiet: true });

  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });

  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
  );
  if (rows.length) await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} CASCADE`);
  await client.end();

  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });
  await rm(".dev-mailbox-e2e", { recursive: true, force: true });
}
