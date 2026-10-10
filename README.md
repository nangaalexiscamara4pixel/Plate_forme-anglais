# GlobeSpeak Academy

Plateforme internationale premium d'apprentissage de l'anglais (CECRL A1 → B2), avec cours en direct sur Google Meet et accès sur approbation.

> **État : phase 1 / 7 terminée** (fondations, authentification, workflow d'approbation, sécurité).
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

Cette commande démarre un serveur PostgreSQL local (Prisma Postgres, basé sur PGlite) et affiche son URL `postgres://…`.

1. Copiez `.env.example` en `.env` et renseignez :
   - `DATABASE_URL` : l'URL **TCP** affichée par `npm run db:start` (remplacez `localhost` par `127.0.0.1`) ;
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

## Tests automatisés

Les tests utilisent une **base dédiée**, jamais celle de développement : la suite vide ses tables.

```bash
npm run db:test:start
```

Copiez `.env.test.example` en `.env.test` et mettez-y l'URL affichée par la commande précédente (avec `127.0.0.1`).

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
- **E2E** : inscription → email → attente → admin avec 2FA → approbation B1 → accès.

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et serveur de production |
| `npm run typecheck` · `npm run lint` | TypeScript · ESLint |
| `npm run db:start` / `db:stop` | serveur Postgres local |
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
