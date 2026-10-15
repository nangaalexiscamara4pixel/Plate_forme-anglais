import { expect, test, type Page } from "@playwright/test";
import { approveStudent, registerStudent, signInAdmin, signInStudent } from "./helpers";

const AMARA = { name: "Amara Diop", email: "amara.practice.e2e@example.test", password: "Golden-River-Compass-31" };
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/shots/${name}.png`, fullPage: true });

test("exercices et devoirs : création, passage, correction automatique, copie corrigée", async ({ browser }) => {
  const student = await registerStudent(browser, AMARA);
  const admin = await signInAdmin(browser);
  await approveStudent(admin, AMARA.name, "A1 – Discovery");
  await signInStudent(student, AMARA);

  // ── L'enseignant crée un exercice A1 avec trois questions, puis le publie ──
  await admin.goto("/admin/exercises");
  await admin.getByLabel("Titre").fill("Present simple : to be");
  await admin.locator("#field-levelId").selectOption({ label: "A1 · Discovery" });
  await admin.getByRole("button", { name: "Créer et ajouter des questions" }).click();
  await expect(admin).toHaveURL(/\/admin\/exercises\/[\w-]+$/);

  // 1. Choix unique (la 2e proposition est juste)
  await admin.getByLabel("Énoncé").fill("She ___ a teacher.");
  await admin.getByPlaceholder("Proposition 1").fill("are");
  await admin.getByPlaceholder("Proposition 2").fill("is");
  await admin.getByLabel("Bonne réponse : proposition 2").check();
  await admin.getByLabel("Explication (affichée après la correction)").fill("With he/she/it we use “is”.");
  await admin.getByRole("button", { name: "Enregistrer la question" }).click();
  await expect(admin.getByText("Question enregistrée.")).toBeVisible();

  // 2. Texte à trous avec deux réponses acceptées
  await admin.getByRole("button", { name: "Ajouter une question" }).click();
  await admin.getByLabel("Type de question").selectOption("GAP_FILL");
  await admin.getByLabel("Énoncé").fill("Complete with the verb to be.");
  await admin.getByPlaceholder("I {am|'m} a student").fill("I {am|'m} from Senegal.");
  await expect(admin.getByText("am / 'm")).toBeVisible(); // aperçu
  await admin.getByRole("button", { name: "Enregistrer la question" }).click();
  await expect(admin.getByText("Question enregistrée.").first()).toBeVisible();

  // 3. Vrai ou faux (réponse : faux)
  await admin.getByRole("button", { name: "Ajouter une question" }).click();
  await admin.getByLabel("Type de question").selectOption("TRUE_FALSE");
  await admin.getByLabel("Énoncé").fill("“They is happy” is correct.");
  await admin.getByRole("button", { name: "Faux" }).click();
  await admin.getByRole("button", { name: "Enregistrer la question" }).click();
  await expect(admin.getByRole("heading", { name: "3 questions" })).toBeVisible();
  await shot(admin, "admin-exercise-editor");
  await admin.getByRole("button", { name: "Publier" }).click();
  await expect(admin.getByText("Publié : visible par les étudiants du niveau.")).toBeVisible();

  // ── L'étudiant passe l'exercice : 2 bonnes réponses sur 3 ──
  await student.goto("/app/exercises");
  await shot(student, "student-exercises");
  await student.getByRole("link", { name: /Present simple : to be/ }).click();
  await student.getByRole("button", { name: "Commencer" }).click();
  await student.getByRole("radio", { name: /is/ }).first().click();
  await student.getByLabel("Blanc 1").fill("’M");
  await student.getByRole("radio", { name: "Vrai" }).click();
  await shot(student, "student-exercise-play");
  await student.getByRole("button", { name: "Valider mes réponses" }).click();
  await expect(student.getByText("67 %")).toBeVisible();
  await expect(student.getByText("Réponse attendue :")).toBeVisible();
  await expect(student.getByText("With he/she/it we use “is”.")).toBeVisible();
  await shot(student, "student-exercise-result");

  // La clé de correction n'est jamais envoyée avant la validation
  await student.goto("/app/exercises");
  await student.getByRole("link", { name: /Present simple : to be/ }).click();
  expect(await student.content()).not.toContain("Senegal.\",\"answers");

  // ── Devoir d'expression écrite ──
  await admin.goto("/admin/assignments");
  await admin.getByLabel("Titre").fill("My best friend");
  await admin.getByLabel("Consigne").fill("Describe your best friend in a few sentences: name, age, personality.");
  await admin.getByLabel("Mots minimum").fill("8");
  await admin.getByRole("button", { name: "Créer le devoir" }).click();
  await expect(admin).toHaveURL(/\/admin\/assignments\/[\w-]+$/);
  await admin.getByRole("button", { name: "Publier" }).click();
  await expect(admin.getByText("Publié : visible par les étudiants du niveau.")).toBeVisible();

  await student.goto("/app/assignments");
  await student.getByRole("link", { name: /My best friend/ }).click();
  await student.getByLabel("Votre texte").fill("My friend is Awa.");
  await expect(student.getByText("encore 4 au minimum")).toBeVisible();
  await expect(student.getByRole("button", { name: "Envoyer à mon enseignant" })).toBeDisabled();
  await student.getByLabel("Votre texte").fill("My best friend is Awa. She is twelve and very funny.");
  await expect(student.getByText("Brouillon enregistré")).toBeVisible();
  await shot(student, "student-assignment-writing");
  await student.getByRole("button", { name: "Envoyer à mon enseignant" }).click();
  await expect(student.getByText("Envoyé ! Votre enseignant va le corriger")).toBeVisible();

  // L'enseignant corrige depuis la file d'attente
  await admin.goto("/admin/assignments");
  await expect(admin.getByRole("heading", { name: "1 copie à corriger" })).toBeVisible();
  await admin.getByRole("link", { name: new RegExp(AMARA.name) }).click();
  await expect(admin.getByText("She is twelve and very funny.")).toBeVisible();
  await admin.getByLabel("Note sur 100").fill("85");
  await admin.getByLabel("Commentaire").fill("Very good! Try to add one more sentence about her hobbies.");
  await shot(admin, "admin-review");
  await admin.getByRole("button", { name: "Renvoyer à l'étudiant" }).click();
  await expect(admin.getByText("Correction envoyée à l'étudiant.")).toBeVisible();

  // L'étudiant voit la note et le commentaire, et peut déposer une nouvelle version
  await student.reload();
  await expect(student.getByText("85/100").first()).toBeVisible();
  await expect(student.getByText("Try to add one more sentence about her hobbies.")).toBeVisible();
  await expect(student.getByRole("button", { name: "Améliorer et renvoyer" })).toBeVisible();
  await shot(student, "student-assignment-feedback");

  // ── Devoir d'expression orale : enregistrement au micro, envoi, écoute par l'enseignant ──
  await admin.goto("/admin/assignments");
  await admin.getByRole("button", { name: "Expression orale" }).click();
  await admin.getByLabel("Titre").fill("Introduce yourself");
  await admin.getByLabel("Consigne").fill("Record yourself: say your name, your age and where you live.");
  await admin.getByRole("button", { name: "Créer le devoir" }).click();
  await expect(admin).toHaveURL(/\/admin\/assignments\/[\w-]+$/);
  await admin.getByRole("button", { name: "Publier" }).click();
  await expect(admin.getByText("Publié : visible par les étudiants du niveau.")).toBeVisible();

  // L'enregistrement doit se faire dans un contexte autorisé à utiliser le micro
  await student.context().grantPermissions(["microphone"]);
  await student.goto("/app/assignments");
  await student.getByRole("link", { name: /Introduce yourself/ }).click();
  await student.getByRole("button", { name: "Commencer l'enregistrement" }).click();
  await expect(student.getByRole("timer")).toBeVisible();
  await student.waitForTimeout(2500);
  await student.getByRole("button", { name: "Arrêter" }).click();
  await expect(student.getByText(/^Durée : /)).toBeVisible();
  await shot(student, "student-assignment-speaking");
  await student.getByRole("button", { name: "Envoyer à mon enseignant" }).click();
  await expect(student.getByText("Envoyé ! Votre enseignant va le corriger")).toBeVisible();

  await admin.goto("/admin/assignments");
  await admin.getByRole("link", { name: /Introduce yourself/ }).first().click();
  await admin.getByRole("link", { name: new RegExp(AMARA.name) }).click();
  const audio = admin.locator("audio");
  await expect(audio).toBeVisible();
  const src = await audio.getAttribute("src");
  expect((await admin.request.get(src!, { maxRedirects: 0 })).status()).toBe(302); // l'enseignant y a accès
  expect((await (await browser.newContext()).request.get(`http://localhost:3100${src}`, { maxRedirects: 0 })).status()).toBe(404); // un anonyme non

  // La progression remonte sur la fiche de l'étudiant
  await admin.goto("/admin/students");
  await admin.getByRole("link", { name: new RegExp(AMARA.name) }).click();
  await admin.getByRole("tab", { name: /Progression/ }).click();
  await expect(admin.getByText("Present simple : to be")).toBeVisible();
  await expect(admin.getByText("My best friend")).toBeVisible();
});
