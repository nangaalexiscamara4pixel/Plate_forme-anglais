/**
 * Seed — idempotent (peut être relancé sans dupliquer les données).
 *  - compte administrateur initial (identifiants dans .env)
 *  - 4 niveaux CECRL et leurs 4 modules de compétence
 *  - paramètres de plateforme par défaut
 * Le contenu de démonstration (unités, leçons, exercices) est ajouté en phases 3 et 4.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type LevelCode, type SkillCode } from "../src/generated/prisma/client";
import { hashPassword } from "../src/server/password";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const LEVELS: { code: LevelCode; name: string; tagline: string; icon: string; order: number }[] = [
  { code: "A1", name: "Discovery", tagline: "Débutant — vos premiers pas en anglais", icon: "compass", order: 1 },
  { code: "A2", name: "Explorer", tagline: "Élémentaire — gagner en aisance au quotidien", icon: "telescope", order: 2 },
  { code: "B1", name: "Navigator", tagline: "Intermédiaire — tracer votre route", icon: "globe-2", order: 3 },
  { code: "B2", name: "Ambassador", tagline: "Intermédiaire avancé — parler avec assurance", icon: "crown", order: 4 },
];

const SKILLS: { skill: SkillCode; title: string; description: string }[] = [
  { skill: "READING", title: "Reading", description: "Compréhension écrite" },
  { skill: "SPEAKING", title: "Speaking", description: "Expression orale" },
  { skill: "WRITING", title: "Writing", description: "Expression écrite" },
  { skill: "LISTENING", title: "Listening", description: "Compréhension orale" },
];

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Administrateur";
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD sont requis dans .env");
  if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD doit contenir au moins 12 caractères");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`• Administrateur déjà présent : ${email} (mot de passe inchangé)`);
    return;
  }

  const id = randomUUID();
  await db.user.create({
    data: {
      id,
      email,
      name,
      emailVerified: true,
      role: "ADMIN",
      status: "APPROVED",
      statusChangedAt: new Date(),
      accounts: {
        create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) },
      },
      profile: { create: { privacyConsentAt: new Date(), privacyPolicyVersion: "2026-10" } },
    },
  });
  console.log(`✓ Administrateur créé : ${email}`);
  console.log("  → à la première connexion, la double authentification (TOTP) vous sera demandée.");
}

async function seedLevels() {
  for (const level of LEVELS) {
    const record = await db.level.upsert({
      where: { code: level.code },
      update: { name: level.name, tagline: level.tagline, icon: level.icon, order: level.order },
      create: {
        ...level,
        slug: level.code.toLowerCase(),
        accentColor: `level-${level.code.toLowerCase()}`,
      },
    });
    for (const [index, skill] of SKILLS.entries()) {
      await db.module.upsert({
        where: { levelId_skill: { levelId: record.id, skill: skill.skill } },
        update: {},
        create: { levelId: record.id, skill: skill.skill, title: skill.title, description: skill.description, order: index + 1 },
      });
    }
  }
  console.log(`✓ ${LEVELS.length} niveaux et ${LEVELS.length * SKILLS.length} modules de compétence`);
}

async function seedSettings() {
  const defaults: Record<string, unknown> = {
    "platform.name": "GlobeSpeak Academy",
    "access.lowerLevelsAccessible": true,
    "live.joinWindowMinutes": 15,
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.platformSetting.upsert({ where: { key }, update: {}, create: { key, value: value as never } });
  }
  console.log("✓ Paramètres de plateforme par défaut");
}

async function main() {
  await seedLevels();
  await seedSettings();
  await seedAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
