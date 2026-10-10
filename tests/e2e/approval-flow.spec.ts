import { expect, test } from "@playwright/test";
import { registerStudent, signInAdmin, testEnv } from "./helpers";

const STUDENT = { name: "Amina Diallo", email: "amina.e2e@example.test", password: "Violet-Harbour-Lantern-42" };

test.describe.configure({ mode: "serial" });

test("un visiteur est redirigé vers la connexion depuis l'espace privé", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin$/);
});

test("inscription → attente → approbation par l'admin (2FA) → accès au niveau", async ({ browser }) => {
  // 1-2. L'étudiant s'inscrit et confirme son email → page d'attente
  const student = await registerStudent(browser, STUDENT);
  await expect(student.getByRole("heading", { name: "Votre demande est en cours d'examen" })).toBeVisible();

  // 3. Tant qu'il n'est pas approuvé, il n'accède à rien
  await student.goto("/app");
  await expect(student).toHaveURL(/\/pending$/);
  await student.goto("/admin");
  await expect(student.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

  // 4. L'administrateur se connecte (2FA obligatoire)
  const admin = await signInAdmin(browser);

  // 5. Il approuve la demande depuis le tableau de bord en attribuant le niveau B1
  const row = admin.getByRole("listitem").filter({ hasText: STUDENT.email });
  await row.getByRole("combobox", { name: "Niveau" }).click();
  await admin.getByRole("option", { name: /B1/ }).click();
  await row.getByRole("button", { name: "Approuver" }).click();
  await expect(admin.getByText("Aucune demande en attente")).toBeVisible();

  // 6. L'étudiant accède immédiatement à son espace, au bon niveau
  await student.goto("/app");
  await expect(student).toHaveURL(/\/app$/);
  await expect(student.getByText("B1 – Navigator")).toBeVisible();
  await expect(student.getByRole("heading", { name: /Bonjour, Amina/ })).toBeVisible();

  // 7. Toujours aucun accès au back-office
  await student.goto("/admin");
  await expect(student.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

  // 8. Un code TOTP invalide est refusé
  const admin2 = await (await browser.newContext()).newPage();
  await admin2.goto("/sign-in");
  await admin2.getByLabel("Adresse email").fill(testEnv.SEED_ADMIN_EMAIL!);
  await admin2.getByLabel("Mot de passe").fill(testEnv.SEED_ADMIN_PASSWORD!);
  await admin2.getByRole("button", { name: "Se connecter" }).click();
  await expect(admin2).toHaveURL(/\/two-factor$/);
  await admin2.locator('input[name="code"]').fill("000000");
  await admin2.getByRole("button", { name: "Vérifier" }).click();
  await expect(admin2.getByText("Ce code est invalide ou a expiré.")).toBeVisible();
});

test("les en-têtes de sécurité sont présents", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-powered-by"]).toBeUndefined();
});
