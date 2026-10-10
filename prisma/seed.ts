/**
 * Seed — idempotent (peut être relancé sans dupliquer les données).
 *  - compte administrateur initial (identifiants dans .env)
 *  - 4 niveaux CECRL et leurs 4 modules de compétence
 *  - paramètres de plateforme par défaut
 *  - contenu de démonstration : leçons texte, vidéo sous-titrée, vocabulaire (créé seulement si
 *    la compétence est encore vide — les contenus saisis par l'équipe ne sont jamais écrasés)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type LevelCode, type SkillCode } from "../src/generated/prisma/client";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { blockContentSchemas } from "../src/features/content/blocks";
import { slugify } from "../src/lib/slug";
import { hashPassword } from "../src/server/password";
import { localPath, storage } from "../src/server/storage";
import { DEMO_VIDEO, demoUnits } from "./demo-content";

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


async function seedDemoVideo(): Promise<string> {
  const existing = await db.video.findFirst({ where: { title: DEMO_VIDEO.title } });
  if (existing) return existing.id;
  const source = path.resolve("prisma/demo/demo-lesson.webm");
  const { size } = await stat(source);
  const key = "lesson_video/demo/demo-lesson.webm";
  if (storage.name === "local") {
    await mkdir(path.dirname(localPath(key)), { recursive: true });
    await copyFile(source, localPath(key));
  } else {
    const target = await storage.presignUpload(key, "video/webm", size);
    const res = await fetch(target.url, { method: "PUT", headers: target.headers, body: await readFile(source) });
    if (!res.ok) throw new Error(`Upload de la vidéo de démo impossible (${res.status})`);
  }
  const media = await db.mediaFile.upsert({
    where: { key },
    update: { uploadedAt: new Date() },
    create: { key, mime: "video/webm", sizeBytes: size, originalName: "demo-lesson.webm", purpose: "LESSON_VIDEO", uploadedAt: new Date() },
  });
  const video = await db.video.create({
    data: {
      title: DEMO_VIDEO.title,
      provider: "LOCAL",
      status: "READY",
      durationSec: 32,
      mediaFileId: media.id,
      chapters: DEMO_VIDEO.chapters,
      tracks: {
        create: (["en", "fr"] as const).map((lang) => ({
          lang,
          kind: "SUBTITLES",
          cues: DEMO_VIDEO.subtitles[lang].map(([start, end, text]) => ({ start, end, text })),
        })),
      },
    },
  });
  return video.id;
}

async function seedDemoContent() {
  const videoId = await seedDemoVideo();
  const modules = await db.module.findMany({ include: { level: true, _count: { select: { units: true } } } });
  let created = 0;
  for (const mod of modules) {
    if (mod._count.units > 0) continue;
    for (const [ui, unit] of demoUnits(mod.level.code, mod.skill).entries()) {
      await db.unit.create({
        data: {
          moduleId: mod.id,
          title: unit.title,
          summary: unit.summary,
          slug: slugify(unit.title),
          order: ui + 1,
          status: "PUBLISHED",
          publishAt: new Date(),
          lessons: {
            create: unit.lessons.map((lesson, li) => ({
              title: lesson.title,
              summary: lesson.summary,
              slug: slugify(lesson.title),
              type: lesson.type,
              order: li + 1,
              estimatedMinutes: lesson.minutes,
              status: "PUBLISHED" as const,
              publishAt: new Date(),
              blocks: {
                create: lesson.blocks.map(({ kind, ...content }, bi) => ({
                  order: bi + 1,
                  kind,
                  // Le contenu de démonstration passe par la même validation que l'éditeur.
                  content: blockContentSchemas[kind].parse(content) as object,
                  videoId: kind === "VIDEO" ? videoId : null,
                })),
              },
            })),
          },
        },
      });
      created++;
    }
  }
  console.log(`✓ Contenu de démonstration : ${created} unité(s) créée(s) (vidéo « ${DEMO_VIDEO.title} »)`);
}

async function main() {
  await seedLevels();
  await seedSettings();
  await seedAdmin();
  await seedDemoContent();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
