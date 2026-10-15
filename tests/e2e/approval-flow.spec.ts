import { expect, test } from "@playwright/test";
import { registerStudent, signInAdmin, signInStudent, testEnv, waitForEmail } from "./helpers";

const STUDENT = { name: "Amina Diallo", email: "amina.e2e@example.test", password: "Violet-Harbour-Lantern-42" };

test.describe.configure({ mode: "serial" });

test("un visiteur est redirigé vers la connexion depuis l'espace privé", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin$/);
});

test("inscription → attente → approbation par l'admin (2FA) → accès au niveau", async ({ browser }) => {
  // 1-2. L'étudiant fait sa demande : « enregistrée avec succès », aucun email à confirmer
  const student = await registerStudent(browser, STUDENT);
  await expect(student.getByText("vous recevrez une réponse par email dans les plus brefs délais")).toBeVisible();

  // 3. Tant qu'il n'est pas approuvé, il ne peut pas se connecter : on lui explique pourquoi
  await student.goto("/sign-in");
  await student.getByLabel("Adresse email").fill(STUDENT.email);
  await student.getByLabel("Mot de passe").fill(STUDENT.password);
  await student.getByRole("button", { name: "Se connecter" }).click();
  await expect(student.getByText("Votre demande d'accès est en cours d'examen.")).toBeVisible();
  await student.goto("/app");
  await expect(student).toHaveURL(/\/sign-in/);

  // 4. L'administrateur se connecte (2FA obligatoire)
  const admin = await signInAdmin(browser);

  // 5. Il approuve la demande depuis le tableau de bord en attribuant le niveau B1
  const row = admin.getByRole("listitem").filter({ hasText: STUDENT.email });
  await row.getByRole("combobox", { name: "Niveau" }).click();
  await admin.getByRole("option", { name: /B1/ }).click();
  await row.getByRole("button", { name: "Approuver" }).click();
  await expect(admin.getByText("Aucune demande en attente")).toBeVisible();

  // 6. Il reçoit l'email d'approbation, qui l'invite à se connecter avec son email et son mot de passe
  const mail = await waitForEmail(STUDENT.email, "Votre demande d'accès est acceptée");
  expect(mail.html).toContain("vous connecter à la plateforme avec votre adresse email");
  expect(mail.html).toContain("/sign-in");

  // 7. Il se connecte et accède à son espace, au bon niveau
  await signInStudent(student, STUDENT);
  await expect(student.getByText("B1 – Navigator")).toBeVisible();
  await expect(student.getByRole("heading", { name: /Bonjour, Amina/ })).toBeVisible();

  // 8. Toujours aucun accès au back-office
  await student.goto("/admin");
  await expect(student.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

  // 9. Un code TOTP invalide est refusé
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
