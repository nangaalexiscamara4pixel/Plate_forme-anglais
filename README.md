# GlobeSpeak Academy

Plateforme internationale premium d'apprentissage de l'anglais (CECRL A1 → B2), avec cours en direct sur Google Meet et accès sur approbation.

> **État : phase 3 / 7 terminée** — fondations et sécurité (1), back-office (2), contenus pédagogiques et CMS (3).
> Sécurité : [docs/SECURITY.md](docs/SECURITY.md).
> Architecture complète : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind CSS v4 · shadcn/ui · PostgreSQL + Prisma 7 · Better Auth (Argon2id, 2FA TOTP, sessions en base) · next-intl (FR/EN) · Resend + React Email · Vitest · Playwright.

## Installation locale

Prérequis : **Node.js 22+** (testé avec 24). Docker n'est **pas** nécessaire.

```bash
npm install
```

```bash
npm run db:start
```

Cette commande démarre un **vrai PostgreSQL 17** local. Les binaires officiels sont fournis par le paquet npm `embedded-postgres` et pilotés par [scripts/db.mjs](scripts/db.mjs). Les données sont stockées dans `.pg/dev/`, et le serveur n'écoute que sur `127.0.0.1:54320`. Il continue de tourner en arrière-plan ; `npm run db:stop` l'arrête.

1. Copiez `.env.example` en `.env` et renseignez :
   - `DATABASE_URL` : la valeur par défaut correspond déjà à `npm run db:start` ;
   - `BETTER_AUTH_SECRET` et `ENCRYPTION_KEY` : générez-les avec la commande ci-dessous ;
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` : identifiants du premier administrateur (12 caractères minimum).

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. Créez les tables et les données initiales :

   ```bash
   npm run db:migrate
   ```

   ```bash
   npm run db:seed
   ```

3. Lancez l'application sur http://localhost:3000 :

   ```bash
   npm run dev
   ```

### Emails en développement

Sans `RESEND_API_KEY`, aucun email n'est envoyé : ils sont écrits dans `.dev-mailbox/` et consultables sur **http://localhost:3000/dev/mailbox** (page désactivée en production). C'est là que vous trouverez les liens de vérification et de réinitialisation.

## Premier administrateur

Le seed crée le compte défini par `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. À la première connexion :

1. vous êtes redirigé vers **/setup-2fa** : la double authentification est **obligatoire** pour un administrateur ;
2. confirmez votre mot de passe, scannez le QR code (Google Authenticator, 1Password, Authy…), conservez les codes de secours ;
3. saisissez le code à 6 chiffres : vous arrivez sur **/admin**.

Changez ensuite le mot de passe initial (fonction disponible en phase 2) et retirez `SEED_ADMIN_PASSWORD` du `.env` de production.

## Tester le parcours d'approbation (phase 1)

1. Sur `/sign-up`, créez un compte étudiant.
2. Ouvrez `/dev/mailbox`, puis cliquez le lien de confirmation : vous arrivez sur la page « Votre demande est en cours d'examen ». Les adresses `/app` et `/admin` restent inaccessibles.
3. Dans une autre fenêtre (navigation privée), connectez-vous en administrateur. Sur `/admin`, choisissez un niveau et cliquez **Approuver**.
4. Rechargez la fenêtre de l'étudiant : son espace s'ouvre, au niveau attribué. Il a reçu un email de confirmation.

## Back-office (phase 2)

| Page | Contenu |
|---|---|
| `/admin` | tableau de bord : statuts, demandes en attente, inscriptions sur 30 jours, étudiants actifs par niveau, activité récente |
| `/admin/students` | liste filtrable (statut, niveau, recherche, tri), pagination, export CSV |
| `/admin/students/[id]` | fiche complète (profil, progression, présences, sessions actives, historique) et gestion du compte |
| `/admin/audit` | journal d'audit filtrable (action, auteur, période) |
| `/admin/account` | mot de passe, sessions de l'administrateur |

Actions disponibles sur un compte étudiant, toutes journalisées :

- approuver avec un niveau, rejeter ou suspendre avec un motif, réactiver ;
- passer au niveau supérieur (l'ancien niveau est marqué validé) ou réaffecter ;
- envoyer un lien de réinitialisation du mot de passe : l'administrateur ne voit jamais le mot de passe ;
- révoquer une session ou toutes les sessions ;
- **« Voir en tant qu'étudiant »** : session de 30 minutes en **lecture seule**, avec un bandeau rouge et un bouton « Quitter ce mode ».

Les routes HTTP du plugin admin de Better Auth (`/api/auth/admin/*`) sont fermées : toute action d'administration passe par les Server Actions, qui vérifient la 2FA et écrivent dans le journal d'audit.

## Site public

Page d'accueil inspirée de la maquette fournie :
- mosaïque de photos avec titre défilant (pause au survol, ou via le bouton) ;
- les 4 formations ;
- les 4 compétences, avec une recherche ;
- le déroulé des cours Google Meet ;
- les témoignages et la FAQ ;
- un pied de page avec newsletter en **double opt-in** (confirmation par email, désinscription en un clic).

Pour personnaliser le site, modifiez `src/features/marketing/site-config.ts` :
- **Photos** : déposez les fichiers dans `public/images/site/` (voir le README de ce dossier). En attendant, des visuels aux couleurs de l'Académie s'affichent à leur place.
- **Témoignages** : les exemples fournis sont masqués en production ; remplacez-les par de vrais avis.
- **Réseaux sociaux** : leurs liens.

Les textes du site sont dans `messages/fr.json` et `messages/en.json`, sous la clé `site`.

## Contenus pédagogiques (phase 3)

Hiérarchie : **niveau → compétence → unité → leçon → blocs**. Une leçon est composée de blocs : texte riche, encadré, vidéo, audio, image, liste de vocabulaire. Les blocs d'exercices et de devoirs arrivent en phase 4.

| Page | Rôle |
|---|---|
| `/admin/content` | vue d'ensemble des 4 niveaux × 4 compétences |
| `/admin/content/[niveau]/[compétence]` | unités et leçons : création, réorganisation par glisser-déposer (souris ou clavier), publication |
| `/admin/content/lessons/[id]` | éditeur de leçon par blocs (éditeur TipTap) et paramètres (durée, XP, statut) |
| `/admin/content/lessons/[id]/preview` | aperçu « vue étudiant », quel que soit le statut |
| `/admin/media` | médiathèque : vidéos (Mux ou locales), audio, images, PDF |
| `/admin/media/videos/[id]` | chapitres et sous-titres anglais/français (WebVTT ou SRT) |
| `/app/learn/[niveau]/…` | parcours de l'étudiant : compétences, unités, leçons, progression |

**Publication** : brouillon, publié, programmé (visible automatiquement à la date choisie, sans tâche planifiée) ou archivé. Un étudiant ne voit que les contenus publiés de son niveau, plus les niveaux qu'il a validés si le réglage `access.lowerLevelsAccessible` est actif.

**Vidéo** :
- avec les clés `MUX_*` : upload direct vers Mux, lecture **signée** par un jeton de 4 h émis après contrôle d'accès, sans MP4 téléchargeable ;
- sans ces clés (développement) : fichier local servi après la même vérification ;
- dans les deux cas : chapitres, sous-titres EN/FR, transcription synchronisée cliquable, vitesse de lecture, reprise de la position, et filigrane à l'adresse de l'étudiant.

**Fichiers** :
- avec les clés `R2_*` : Cloudflare R2 (bucket privé) ;
- sinon : dossier `.dev-storage/` ;
- dans les deux cas : URLs signées de 5 minutes, vérification du type réel (signature binaire), SVG refusé.

**Contenu de démonstration** : le seed crée 4 unités complètes en A1 (texte, encadrés, vocabulaire, vidéo sous-titrée avec chapitres) et une unité d'introduction par compétence pour A2, B1 et B2, uniquement dans les compétences encore vides. La vidéo de démo (`prisma/demo/demo-lesson.webm`) se régénère avec :

```bash
node scripts/make-demo-video.mjs
```

### Configurer Mux (production)

1. Dans le tableau de bord Mux, créez un token d'API (Video : lecture et écriture) : `MUX_TOKEN_ID` et `MUX_TOKEN_SECRET`.
2. Créez une clé de signature (*Signing keys*) : `MUX_SIGNING_KEY_ID` et `MUX_SIGNING_PRIVATE_KEY` (clé privée encodée en base64, telle que fournie).
3. Créez un webhook vers `https://<votre-domaine>/api/webhooks/mux` et récupérez son secret : `MUX_WEBHOOK_SECRET`.

### Configurer Cloudflare R2 (production)

1. Créez un bucket **privé** (sans accès public) : `R2_BUCKET`.
2. Créez un token d'API R2 avec lecture et écriture sur ce bucket : `R2_ACCESS_KEY_ID` et `R2_SECRET_ACCESS_KEY`. Votre identifiant de compte va dans `R2_ACCOUNT_ID`.
3. Dans la politique CORS du bucket, autorisez `PUT` et `GET` depuis votre domaine (uploads directs depuis le navigateur).

## Tests automatisés

Les tests utilisent une **base dédiée**, jamais celle de développement : la suite vide ses tables.

```bash
npm run db:test:start
```

Cette commande démarre une seconde instance (port 54321, base `globespeak_test`). Copiez ensuite `.env.test.example` en `.env.test` : les valeurs par défaut lui correspondent.

```bash
npm test
```

Lance les tests unitaires et d'intégration (Vitest, sur une base réelle).

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

Lance les tests end-to-end (Playwright, serveur de test sur le port 3100). Arrêtez d'abord `npm run dev` : deux serveurs Next.js ne peuvent pas partager le même dossier `.next`.

Ce qui est couvert aujourd'hui :

- **Approbation** : un nouveau compte est toujours un étudiant en attente ; la machine à états des statuts ; le niveau obligatoire à l'approbation ; l'audit ; les emails ; la révocation des sessions au rejet ou à la suspension.
- **Contrôle d'accès** : un compte non approuvé est bloqué partout ; le back-office renvoie une 404 aux étudiants ; la 2FA est imposée à l'admin ; les sessions admin expirent après 12 h ; l'impersonation est autorisée côté étudiant et refusée côté admin.
- **Sécurité** : verrouillage progressif après 5 échecs ; limitation de débit (identifiants hachés) ; inscription HTTP directe interdite ; hachage Argon2id ; chiffrement AES-GCM ; protection contre les redirections ouvertes ; en-têtes CSP/HSTS.
- **Back-office** : changement de niveau (promotion ou réaffectation) ; anti-IDOR sur la révocation de sessions ; filtres et tableau de bord ; export CSV protégé contre l'injection de formules ; journal d'audit ; routes admin HTTP fermées ; impersonation en lecture seule et non applicable aux administrateurs.
- **E2E** :
  - inscription → email → attente → admin avec 2FA → approbation B1 → accès ;
  - fiche étudiant → approbation A2 → « voir en tant que » → sortie → suspension avec motif → étudiant bloqué → audit → export CSV ;
  - étudiant A1 : vidéo sous-titrée, transcription, flux refusé aux anonymes, leçon B1 introuvable ; l'admin crée et publie une leçon, que l'étudiant voit ensuite.
- **Contenus** : isolation par niveau et par statut de publication ; accès aux médias uniquement via une leçon autorisée ; liste blanche du texte riche (XSS) ; réordonnancement anti-IDOR ; signature binaire des uploads ; jetons de stockage ; protection contre le path traversal.

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et serveur de production |
| `npm run typecheck` · `npm run lint` | TypeScript · ESLint |
| `npm run db:start` / `db:stop` | PostgreSQL local de développement |
| `npm run db:test:start` / `db:test:stop` | PostgreSQL local de test |
| `npm run db:migrate` | crée/applique les migrations (dev) |
| `npm run db:deploy` | applique les migrations (production) |
| `npm run db:seed` | données initiales (idempotent) |
| `npm run db:studio` | explorateur de base Prisma Studio |
| `npm test` · `npm run test:e2e` | tests Vitest · Playwright |

## Organisation du code

```
src/
├─ app/[locale]/        pages (marketing, auth, portail d'attente, /app étudiant, /admin)
├─ app/api/auth/        point d'entrée Better Auth
├─ features/<domaine>/  actions serveur, schémas Zod, services, composants
├─ server/              auth, db, DAL (gardes d'accès), audit, emails, sécurité
├─ components/          design system (ui/ = shadcn) et marque
├─ i18n/ · messages/    internationalisation
└─ proxy.ts             CSP à nonce, redirections, langue
prisma/                 schéma, migrations, seed
tests/                  unit/ · integration/ · e2e/
```

**Règle de sécurité** : toute page ou Server Action passe par une garde de `src/server/dal/guards.ts` (`requireApprovedStudent`, `requireAdmin`, `assertApprovedStudent({ mutation: true })`…). Le `proxy` ne fait qu'un premier tri.

## Production (aperçu — détaillé en phase 7)

- Base Neon (chaîne *pooled*, `sslmode=require`) → `npm run db:deploy` puis `npm run db:seed`.
- Vercel : définir toutes les variables de `.env.example` ; `APP_URL` = domaine HTTPS final. `RESEND_API_KEY` est obligatoire (le démarrage échoue sinon).
- Domaine d'envoi vérifié dans Resend (SPF/DKIM).
