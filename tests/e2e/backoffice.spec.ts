import { expect, test } from "@playwright/test";
import { registerStudent, signInAdmin } from "./helpers";

const LENA = { name: "Lena Park", email: "lena.e2e@example.test", password: "Copper-Meadow-Lantern-77" };

test.describe.configure({ mode: "serial" });

test("back-office : approbation depuis la fiche, impersonation, suspension, audit, export", async ({ browser }) => {
  const student = await registerStudent(browser, LENA);
  const admin = await signInAdmin(browser);

  // Liste filtrée sur les demandes en attente → fiche étudiant
  await admin.goto("/admin/students?status=PENDING");
  await admin.getByRole("link", { name: new RegExp(LENA.name) }).click();
  await expect(admin.getByRole("heading", { level: 1, name: LENA.name })).toBeVisible();

  // Approbation au niveau A2 via la boîte de dialogue
  await admin.getByRole("button", { name: "Approuver" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Niveau").selectOption({ label: "A2 – Explorer" });
  await dialog.getByRole("button", { name: "Approuver" }).click();
  await expect(admin.getByText("Compte approuvé.")).toBeVisible();
  await expect(admin.getByText("A2").first()).toBeVisible();

  // « Voir en tant qu'étudiant » : bandeau rouge, lecture seule, back-office inaccessible
  await admin.getByRole("button", { name: "Voir en tant qu'étudiant" }).click();
  await expect(admin).toHaveURL(/\/app$/);
  await expect(admin.getByRole("status").filter({ hasText: `Mode « voir en tant que » : ${LENA.name}` })).toBeVisible();
  await expect(admin.getByText("A2 – Explorer")).toBeVisible();
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  await admin.goto("/app");
  await admin.getByRole("button", { name: "Quitter ce mode" }).click();
  await expect(admin).toHaveURL(/\/admin\/students\/[\w-]+$/);
  await expect(admin.getByRole("heading", { level: 1, name: LENA.name })).toBeVisible();

  // Suspension avec motif → l'étudiant est déconnecté et ne voit plus que la page de statut
  await admin.getByRole("button", { name: "Suspendre le compte" }).click();
  await admin.getByRole("dialog").getByLabel("Motif (facultatif)").fill("Comportement inapproprié en cours");
  await admin.getByRole("dialog").getByRole("button", { name: "Suspendre le compte" }).click();
  await expect(admin.getByText("Compte suspendu.")).toBeVisible();

  await student.goto("/app");
  await expect(student).toHaveURL(/\/sign-in/); // sessions révoquées
  await student.getByLabel("Adresse email").fill(LENA.email);
  await student.getByLabel("Mot de passe").fill(LENA.password);
  await student.getByRole("button", { name: "Se connecter" }).click();
  await expect(student).toHaveURL(/\/account-status$/);
  await expect(student.getByRole("heading", { name: "Votre compte est suspendu" })).toBeVisible();
  await expect(student.getByText("Comportement inapproprié en cours")).toBeVisible();

  // Journal d'audit : toutes les actions sont tracées
  await admin.goto("/admin/audit");
  for (const label of ["a approuvé un compte", "a commencé une consultation « en tant que »", "a quitté le mode « en tant que »", "a suspendu un compte"]) {
    await expect(admin.getByRole("table").getByText(label).first()).toBeVisible();
  }

  // Export CSV : réservé à l'admin (404 sinon)
  const csv = await admin.request.get("/api/admin/students/export?status=SUSPENDED");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain(LENA.email);
  const anonymous = await student.request.get("/api/admin/students/export");
  expect(anonymous.status()).toBe(404);
});
