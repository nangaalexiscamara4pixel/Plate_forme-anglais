import { expect, test, type Page } from "@playwright/test";
import { registerStudent, signInAdmin, signInStudent } from "./helpers";

const NOAH = { name: "Noah Martin", email: "noah.e2e@example.test", password: "Silver-Compass-Harbour-31" };

test.describe.configure({ mode: "serial" });

async function approve(admin: Page, email: string, level: RegExp) {
  await admin.goto("/admin");
  const row = admin.getByRole("listitem").filter({ hasText: email });
  await row.getByRole("combobox", { name: "Niveau" }).click();
  await admin.getByRole("option", { name: level }).click();
  await row.getByRole("button", { name: "Approuver" }).click();
  await expect(row).toHaveCount(0);
}

test("contenus : parcours étudiant A1, vidéo sécurisée, isolation par niveau, création par l'admin", async ({ browser }) => {
  const student = await registerStudent(browser, NOAH);
  const admin = await signInAdmin(browser);
  await approve(admin, NOAH.email, /A1/);
  await signInStudent(student, NOAH);

  // « Mes cours » ouvre le niveau de l'étudiant, avec ses 4 compétences
  await student.goto("/app/learn");
  await expect(student).toHaveURL(/\/app\/learn\/a1$/);
  for (const skill of ["Reading", "Listening", "Speaking", "Writing"]) {
    await expect(student.getByRole("heading", { level: 2, name: skill })).toBeVisible();
  }

  // Leçon vidéo : lecteur, sous-titres EN/FR, chapitres, transcription synchronisée
  await student.getByRole("link", { name: /Listening/ }).click();
  await student.getByRole("link", { name: /Hello & Goodbye — video/ }).click();
  await expect(student.getByRole("heading", { level: 1, name: "Hello & Goodbye — video" })).toBeVisible();
  const video = student.locator("video");
  await expect(video).toHaveAttribute("controlslist", /nodownload/);
  await expect(video.locator("track")).toHaveCount(2);
  await expect(student.getByRole("button", { name: /Asking how someone is/ })).toBeVisible();
  await student.getByRole("button", { name: "Transcription" }).click();
  await expect(student.getByRole("button", { name: "I'm fine, thank you. And you?" })).toBeVisible();

  // Le flux vidéo est servi à l'étudiant autorisé… mais pas à un visiteur anonyme
  const src = await video.getAttribute("src");
  expect(src).toMatch(/^\/api\/video\/[\w-]+\/stream$/);
  const streamed = await student.request.get(src!, { headers: { Range: "bytes=0-15" } });
  expect(streamed.status()).toBe(206);
  const anonymous = await (await browser.newContext()).request.get(`http://localhost:3100${src}`, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(404);

  await student.getByRole("button", { name: "Marquer comme terminée" }).click();
  await expect(student.getByText("Leçon terminée — bravo !")).toBeVisible();

  // Isolation : une leçon B1, même avec son URL exacte, est introuvable pour un étudiant A1
  await student.goto("/app/learn/b1/reading/travel-stories/following-a-narrative");
  await expect(student.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  await student.goto("/app/learn/b1");
  await expect(student.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

  // L'admin crée une unité et une leçon, rédige le texte, puis publie
  await admin.goto("/admin/content/a1/reading");
  await admin.getByRole("button", { name: "Nouvelle unité" }).click();
  await admin.getByRole("dialog").getByLabel("Titre").fill("Numbers");
  await admin.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await expect(admin.getByText("Numbers", { exact: true })).toBeVisible();

  const unitCard = admin.locator("li").filter({ hasText: "Numbers" }).first();
  await unitCard.getByRole("button", { name: "Nouvelle leçon" }).click();
  await admin.getByRole("dialog").getByLabel("Titre").fill("Counting to ten");
  await admin.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await admin.getByRole("link", { name: "Counting to ten" }).click();
  await expect(admin.getByRole("heading", { level: 1, name: "Counting to ten" })).toBeVisible();

  const editor = admin.getByRole("textbox", { name: "Texte" });
  await editor.click();
  await editor.pressSequentially("One, two, three, four, five.");
  const block = admin.getByRole("article", { name: "Texte" });
  await block.getByRole("button", { name: "Enregistrer" }).click();
  await expect(admin.getByText("Bloc enregistré.")).toBeVisible();

  // Tant que la leçon est un brouillon, l'étudiant ne la voit pas
  await student.goto("/app/learn/a1/reading");
  await expect(student.getByText("Counting to ten")).toHaveCount(0);

  const settings = admin.locator("aside");
  await settings.getByLabel("Publication").selectOption("PUBLISHED");
  await settings.getByRole("button", { name: "Enregistrer" }).click();
  await expect(settings.getByText("Enregistré.")).toBeVisible();
  await admin.goto("/admin/content/a1/reading");
  await unitCard.getByRole("button", { name: "Modifier l'unité" }).click();
  await admin.getByRole("dialog").getByLabel("Publication").selectOption("PUBLISHED");
  await admin.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(admin.getByText("Enregistré.").first()).toBeVisible();

  // Publiée : l'étudiant la voit et la lit
  await student.goto("/app/learn/a1/reading");
  await student.getByRole("link", { name: /Counting to ten/ }).click();
  await expect(student.getByText("One, two, three, four, five.")).toBeVisible();
});
