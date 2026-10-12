import { expect, test, type Page } from "@playwright/test";
import { registerStudent, signInAdmin } from "./helpers";

const KWAME = { name: "Kwame Mensah", email: "kwame.live.e2e@example.test", password: "Silver-Harbour-Kite-58" };

test.use({ permissions: ["camera", "microphone"], launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

/** Programme une séance qui commence dans 5 minutes (fuseau affiché par le formulaire). */
async function scheduleSession(admin: Page, title: string, level: string) {
  await admin.goto("/admin/live");
  const hint = await admin.getByText(/^Fuseau : /).textContent();
  const timeZone = hint!.replace("Fuseau : ", "").replaceAll(" ", "_");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date(Date.now() + 5 * 60_000))
      .map((p) => [p.type, p.value]),
  );
  await admin.getByLabel("Titre").fill(title);
  await admin.locator("#field-levelId").selectOption({ label: level });
  await admin.getByLabel("Date").fill(`${parts.year}-${parts.month}-${parts.day}`);
  await admin.getByLabel("Heure").fill(`${parts.hour}:${parts.minute}`);
  await admin.getByRole("button", { name: "Programmer la séance" }).click();
  await expect(admin.getByText("Séance programmée.")).toBeVisible();
  const card = admin.getByRole("listitem").filter({ hasText: title });
  return (await card.getByRole("link").getAttribute("href"))!;
}

test("salle virtuelle : accès par niveau, chat, j'aime, main levée, prise de parole", async ({ browser }) => {
  const student = await registerStudent(browser, KWAME);
  const admin = await signInAdmin(browser);

  // Approbation au niveau A1
  await admin.goto("/admin/students?status=PENDING");
  await admin.getByRole("link", { name: new RegExp(KWAME.name) }).click();
  await admin.getByRole("button", { name: "Approuver" }).click();
  await admin.getByRole("dialog").getByLabel("Niveau").selectOption({ label: "A1 – Discovery" });
  await admin.getByRole("dialog").getByRole("button", { name: "Approuver" }).click();
  await expect(admin.getByText("Compte approuvé.")).toBeVisible();

  const a1Room = await scheduleSession(admin, "Speaking club A1", "A1 · Discovery");
  const a2Room = await scheduleSession(admin, "Speaking club A2", "A2 · Explorer");

  // L'étudiant ne voit que les séances de son niveau
  await student.goto("/app/live");
  await expect(student.getByText("Speaking club A1")).toBeVisible();
  await expect(student.getByText("Speaking club A2")).toHaveCount(0);

  // … et la salle d'un autre niveau n'existe pas pour lui (404, pas de flux temps réel)
  await student.goto(a2Room);
  await expect(student.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  expect((await student.request.get(`/api/live/${a2Room.split("/").pop()}/events`)).status()).toBe(403);

  // L'enseignant ouvre la salle, l'étudiant entre
  await admin.goto(a1Room);
  await admin.getByRole("button", { name: "Entrer dans la salle" }).click();
  await expect(admin.getByRole("button", { name: "Lever la main" })).toBeVisible();
  await student.goto(a1Room);
  await expect(student.getByText("Mode démo")).toBeVisible();
  await student.getByRole("button", { name: "Entrer dans la salle" }).click();
  await expect(student.getByRole("button", { name: "Lever la main" })).toBeVisible();
  await expect(admin.getByText(KWAME.name).first()).toBeVisible(); // présence en temps réel

  // Micro ouvert : un clic l'active (sans maintenir de touche), un autre le coupe
  await student.getByRole("button", { name: "Activer le micro" }).click();
  await expect(student.getByRole("button", { name: "Couper le micro" })).toBeVisible();
  await student.waitForTimeout(1500);
  await expect(student.getByRole("button", { name: "Couper le micro" })).toBeVisible(); // toujours actif
  await expect(student.getByRole("button", { name: "Maintenir pour parler" })).toHaveCount(0);
  await student.getByRole("button", { name: "Couper le micro" }).click();
  await expect(student.getByRole("button", { name: "Activer le micro" })).toBeVisible();

  // Chat dans les deux sens, en direct
  await student.getByLabel("Écrire un message…").fill("Good evening, teacher!");
  await student.keyboard.press("Enter");
  await expect(admin.getByText("Good evening, teacher!")).toBeVisible();
  await admin.getByLabel("Écrire un message…").fill("Welcome Kwame!");
  await admin.keyboard.press("Enter");
  await expect(student.getByText("Welcome Kwame!")).toBeVisible();

  // J'aime : compteur mis à jour chez l'auteur
  const row = admin.locator("div.group").filter({ hasText: "Good evening, teacher!" });
  await row.hover();
  await row.getByRole("button", { name: "J'aime", exact: true }).click();
  await expect(student.getByRole("button", { name: "1 j'aime" })).toBeVisible();

  // Main levée → notification de l'enseignant → prise de parole
  await student.getByRole("button", { name: "Lever la main" }).click();
  await expect(admin.getByText(`${KWAME.name} lève la main`)).toBeVisible();
  await admin.getByRole("button", { name: /Participants/ }).click();
  await admin.getByRole("complementary", { name: "Discussion et participants" }).getByRole("listitem").filter({ hasText: KWAME.name }).getByRole("button", { name: "Donner la parole" }).click();
  await expect(student.getByText("L'enseignant vous donne la parole")).toBeVisible();
  await expect(student.getByRole("button", { name: "Lever la main" })).toBeVisible(); // main baissée

  // Modération : l'enseignant supprime un message, il disparaît chez l'étudiant
  await admin.getByRole("tab", { name: /Chat/ }).click();
  await row.hover();
  await row.getByRole("button", { name: "Supprimer le message" }).click();
  await expect(student.getByText("Good evening, teacher!")).toHaveCount(0);
});
