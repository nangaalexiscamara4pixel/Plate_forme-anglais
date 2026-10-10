import { randomUUID } from "node:crypto";
import type { AccountStatus, Role } from "@/generated/prisma/client";
import { db } from "@/server/db";

/** Vide toutes les tables applicatives (ordre indifférent grâce à CASCADE). */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export async function seedLevels() {
  const codes = ["A1", "A2", "B1", "B2"] as const;
  return Promise.all(
    codes.map((code, i) =>
      db.level.create({
        data: { code, slug: code.toLowerCase(), name: code, tagline: code, accentColor: code, icon: "x", order: i + 1 },
      }),
    ),
  );
}

export async function createUser(
  overrides: Partial<{ email: string; name: string; role: Role; status: AccountStatus; currentLevelId: string }> = {},
) {
  const id = randomUUID();
  return db.user.create({
    data: {
      id,
      email: overrides.email ?? `${id.slice(0, 8)}@example.test`,
      name: overrides.name ?? "Test User",
      emailVerified: true,
      role: overrides.role ?? "STUDENT",
      status: overrides.status ?? "PENDING",
      currentLevelId: overrides.currentLevelId,
      profile: { create: {} },
    },
  });
}

export async function createSession(userId: string) {
  return db.session.create({
    data: {
      id: randomUUID(),
      token: randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
}
