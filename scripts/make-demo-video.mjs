#!/usr/bin/env node
/**
 * Génère prisma/demo/demo-lesson.webm : courte animation pédagogique (~32 s) utilisée par le
 * seed comme « vidéo factice » de démonstration, sans compte Mux. Enregistrée par Chromium headless.
 *   node scripts/make-demo-video.mjs
 * Les sous-titres correspondants sont définis dans prisma/demo-content.ts (mêmes horaires).
 */
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

export const SLIDES = [
  { at: 0, en: "Hello & Goodbye", fr: "A1 · Discovery — Listening", big: true },
  { at: 4, en: "Hello!", fr: "Bonjour ! / Salut !" },
  { at: 8, en: "Good morning.", fr: "Bonjour (le matin)." },
  { at: 12, en: "How are you?", fr: "Comment allez-vous ?" },
  { at: 16, en: "I'm fine, thank you. And you?", fr: "Je vais bien, merci. Et vous ?" },
  { at: 20, en: "Nice to meet you!", fr: "Enchanté(e) !" },
  { at: 24, en: "See you tomorrow. Goodbye!", fr: "À demain. Au revoir !" },
  { at: 28, en: "GlobeSpeak Academy", fr: "Well done!", big: true },
];
const DURATION = 32;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:#0B1B3A;font-family:Georgia,serif;overflow:hidden}
  .s{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .6s}
  .s.on{opacity:1}
  .en{color:#FAF8F3;font-size:84px;letter-spacing:-1px}
  .big .en{font-size:96px}
  .fr{color:#C9A961;font-family:Arial,sans-serif;font-size:34px;margin-top:24px;letter-spacing:1px}
  .orb{position:absolute;width:900px;height:900px;border-radius:50%;border:2px solid rgba(255,255,255,.06);right:-300px;top:-200px}
  .bar{position:absolute;left:0;bottom:0;height:8px;background:#C9A961;width:0;transition:width 1s linear}
</style></head><body><div class="orb"></div>
${SLIDES.map((s, i) => `<div class="s${s.big ? " big" : ""}" id="s${i}"><div class="en">${s.en}</div><div class="fr">${s.fr}</div></div>`).join("")}
<div class="bar" id="bar"></div>
<script>
  const at=${JSON.stringify(SLIDES.map((s) => s.at))};const t0=performance.now();
  function tick(){const t=(performance.now()-t0)/1000;let cur=0;at.forEach((a,i)=>{if(t>=a)cur=i});
    document.querySelectorAll('.s').forEach((el,i)=>el.classList.toggle('on',i===cur));
    document.getElementById('bar').style.width=Math.min(100,t/${DURATION}*100)+'%';requestAnimationFrame(tick)}
  tick();
</script></body></html>`;

const outDir = path.resolve("prisma/demo");
const tmp = path.join(outDir, ".rec");
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
const page = await context.newPage();
await page.setContent(html);
await page.waitForTimeout(DURATION * 1000);
await context.close();
await browser.close();
const [file] = await readdir(tmp);
await rename(path.join(tmp, file), path.join(outDir, "demo-lesson.webm"));
await rm(tmp, { recursive: true, force: true });
console.log("✓ prisma/demo/demo-lesson.webm");
