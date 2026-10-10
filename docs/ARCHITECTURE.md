# GlobeSpeak Academy — Plan d'architecture

> Version 0.2 — 10/10/2026 — **Validé** (toutes les recommandations acceptées)

## Ajustements décidés pendant la phase 1

- **Cache Components désactivé** : application authentifiée et personnalisée, rendu dynamique partout. On écarte ainsi tout risque de mettre en cache des données propres à un utilisateur, et la CSP à nonce l'exige de toute façon.
- **Limitation de débit stockée dans Postgres par défaut** (table `rateLimit`, upsert atomique) : aucun service externe n'est requis. Upstash Redis reste optionnel et est utilisé automatiquement s'il est configuré.
- **Inscription uniquement via Server Action** : l'endpoint HTTP `/api/auth/sign-up/email` est bloqué. Cela garantit la validation Zod, le consentement RGPD et le contrôle de robustesse du mot de passe.
- **Plugin next-intl remplacé par un alias** `next-intl/config` dans `next.config.ts` : le plugin charge un binaire natif (SWC) inutile ici.
- **`forbidden()` non utilisé** : l'API est encore expérimentale. Un étudiant qui tente d'accéder au back-office reçoit une 404, qui ne révèle pas l'existence de la zone.
- **Développement local sans Docker** : serveur `prisma dev` (PGlite). Une base séparée sert aux tests.
> Plateforme premium d'apprentissage de l'anglais (CECRL A1 → B2), cours live sur Google Meet.

---

## 0. Résumé exécutif

| Domaine | Choix |
|---|---|
| Framework | Next.js 16 (App Router, RSC, Server Actions) + TypeScript `strict` |
| UI | Tailwind CSS v4 + shadcn/ui + Framer Motion (`motion`) + Lucide |
| Données | PostgreSQL (Neon) + Prisma ORM |
| Auth | **Better Auth** (au lieu d'Auth.js v5 — voir §1.2) + Argon2id |
| Rate limiting / jobs | Upstash Redis (`@upstash/ratelimit`) + Upstash QStash (tâches planifiées) |
| Emails | Resend + React Email |
| Vidéo | Mux (lecture signée JWT, sans téléchargement MP4) |
| Fichiers | Cloudflare R2 (bucket privé, URLs pré-signées courtes) |
| Éditeur | TipTap (stockage JSON ProseMirror, rendu serveur en liste blanche) |
| Validation | Zod (schémas partagés client/serveur) |
| i18n | next-intl (FR/EN, extensible) |
| Tests | Vitest (+ Postgres de test réel) + Playwright |
| Déploiement | Vercel + Neon |

Principe directeur : **défense en profondeur**. Le `proxy` (ex-middleware) n'est qu'un premier filtre ; l'autorisation réelle est faite dans une **couche d'accès aux données (DAL)** côté serveur, appelée par chaque page, Server Action et route API.

---

## 1. Stack technique et justification des écarts

### 1.1 Conservé tel que demandé
Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, Framer Motion, Lucide, PostgreSQL, Prisma, Argon2id, Resend/React Email, R2, TipTap, Zod, next-intl, Vitest, Playwright, Vercel + Neon.

### 1.2 Écarts proposés (à valider)

**a) Better Auth à la place d'Auth.js (NextAuth v5)** — *recommandé*
- Avec Auth.js, le provider *Credentials* (email/mot de passe) impose des sessions JWT : **impossible de révoquer proprement une session** ("déconnecter de tous les appareils") sans réinventer une couche de sessions en base.
- Auth.js ne fournit nativement ni TOTP, ni vérification d'email pour credentials, ni rate limiting, ni impersonation. Il faudrait tout écrire à la main, ce qui est précisément là où naissent les failles.
- Better Auth fournit, testés et maintenus : sessions **en base** révocables, plugin `twoFactor` (TOTP + codes de secours), plugin `admin` (rôles, ban, **impersonation** avec traçabilité `impersonatedBy`), vérification d'email, reset de mot de passe, rate limiting, Google OAuth, adaptateur Prisma, et hachage personnalisable (on branche **Argon2id** via `@node-rs/argon2`).
- Si vous tenez à Auth.js, c'est faisable (sessions DB + code maison pour 2FA/impersonation/lockout), avec ~1 semaine de travail et de surface d'attaque en plus.

**b) Next.js 16 : `proxy.ts` au lieu de `middleware.ts`**
Next 16 a renommé le middleware en *proxy* (runtime Node). Rôle identique : redirection rapide selon la présence/validité de session. Rappel : la CVE-2025-29927 (contournement du middleware Next.js) montre qu'il ne faut **jamais** s'appuyer uniquement dessus → contrôles systématiques dans la DAL.

**c) Upstash (Redis + QStash)** — *ajout*
- Le rate limiting en mémoire ne fonctionne pas en serverless (instances multiples) → Redis distribué.
- Les rappels 24h/1h, la publication programmée et le nettoyage nécessitent des tâches planifiées ; Vercel Cron en dessous du quotidien exige le plan Pro. QStash (offre gratuite suffisante) appelle nos routes `/api/cron/*` avec **signature vérifiée**.

**d) Mux plutôt que Cloudflare Stream** — *recommandé, alternative possible*
Mux : politiques de lecture signées (JWT), restrictions de domaine (referrer), pistes de sous-titres multiples, chapitres natifs dans `mux-player`, webhooks propres, DX excellente. Cloudflare Stream est moins cher et colle à R2 ; les deux sont abstraits derrière une interface `VideoProvider` pour pouvoir changer.

**e) Librairies complémentaires**
| Besoin | Librairie |
|---|---|
| Glisser-déposer (CMS, exercices) | `@dnd-kit` |
| Graphiques (radar, dashboards) | Recharts (via shadcn/ui charts) |
| Fuseaux horaires | `date-fns` + `@date-fns/tz` (stockage UTC + zone IANA) |
| Récurrence des sessions | `rrule` |
| Répétition espacée | `ts-fsrs` (algorithme FSRS, supérieur à SM-2) |
| PDF certificats | `@react-pdf/renderer` + `qrcode` |
| Sanitization HTML | rendu TipTap en liste blanche + `sanitize-html` en filet |
| PWA | Serwist (successeur de next-pwa) |
| Calendrier | composant maison (semaine/mois) sur `date-fns` — plus léger et stylable que FullCalendar |
| Formulaires | `react-hook-form` + `@hookform/resolvers/zod` |
| Logs | `pino` avec **redaction** des champs sensibles |
| Monitoring (optionnel) | Sentry avec scrubbing PII |
| Google Calendar (optionnel) | `googleapis` (compte de service ou OAuth admin) |

---

## 2. Architecture applicative

```
Navigateur ──► Vercel Edge/Node
               │
               ├─ proxy.ts ............ filtre rapide : cookie session ? locale ? → redirections
               │
               ├─ Layouts (RSC) ....... garde serveur : requireApproved() / requireAdmin()
               │
               ├─ Pages (RSC) ─────┐
               ├─ Server Actions ──┼──► DAL (src/server/dal/*) ── Prisma ── PostgreSQL (Neon)
               └─ Route handlers ──┘      │  • vérifie session + statut + rôle + niveau
                                          │  • injecte userId de la SESSION (jamais du client)
                                          │  • journalise les actions admin (AuditLog)
                                          │
                                          ├─► Mux (jetons de lecture signés)
                                          ├─► R2 (URLs pré-signées 5 min)
                                          ├─► Resend (emails)
                                          ├─► Upstash Redis (rate limit, lockout)
                                          └─► Google Calendar API (optionnel)
QStash (cron) ──► /api/cron/* (signature vérifiée) : rappels, publications programmées, purge
Mux ───────────► /api/webhooks/mux (signature vérifiée) : état des assets vidéo
```

### 2.1 Organisation du code (par fonctionnalité)

```
src/
├─ app/
│  ├─ [locale]/
│  │  ├─ (marketing)/          # pages publiques
│  │  ├─ (auth)/               # connexion, inscription, reset, 2FA
│  │  ├─ (gate)/               # pending / rejected / suspended / verify-email
│  │  ├─ (student)/app/...     # espace étudiant (APPROVED + STUDENT)
│  │  └─ (admin)/admin/...     # back-office (ADMIN + 2FA)
│  ├─ api/                     # auth, uploads, video token, cron, webhooks, join Meet, PDF
│  ├─ manifest.ts, robots.ts, sitemap.ts
│  └─ global-error.tsx
├─ features/
│  ├─ auth/  approval/  students/  audit/  impersonation/
│  ├─ content/  lessons/  video/  media/
│  ├─ exercises/  assignments/  grading/  progress/  vocabulary/
│  ├─ live/  attendance/  calendar/
│  ├─ gamification/  certificates/  placement/
│  ├─ messaging/  announcements/  notifications/
│  └─ settings/  privacy/  marketing/
│     └─ chaque feature : actions.ts · queries.ts · schemas.ts · service.ts · components/ · *.test.ts
├─ server/
│  ├─ db.ts                  # client Prisma
│  ├─ auth.ts                # config Better Auth
│  ├─ dal/guards.ts          # requireSession, requireApproved, requireAdmin, requireLevelAccess…
│  ├─ audit.ts  rate-limit.ts  crypto.ts (AES-256-GCM)  logger.ts
│  ├─ email/ (templates React Email)  storage/ (R2)  video/ (Mux)  google/ (Calendar)
├─ components/ui/            # shadcn/ui
├─ components/brand/         # globe, logo, badges de niveau…
├─ lib/                      # utils purs (dates, format, zod helpers)
├─ i18n/  messages/{fr,en}.json
└─ styles/
prisma/  schema.prisma · migrations/ · seed.ts
tests/   unit/ · integration/ (DB réelle) · e2e/ (Playwright)
docs/    ARCHITECTURE.md · SECURITY.md · GOOGLE_MEET.md · DEPLOYMENT.md
```

---

## 3. Modèle de données (Prisma — vue condensée)

### 3.1 Enums
```
Role              ADMIN | STUDENT
AccountStatus     PENDING | APPROVED | REJECTED | SUSPENDED
LevelCode         A1 | A2 | B1 | B2
SkillCode         READING | SPEAKING | WRITING | LISTENING
PublishStatus     DRAFT | SCHEDULED | PUBLISHED | ARCHIVED
LessonType        TEXT | VIDEO | MIXED
BlockKind         RICH_TEXT | VIDEO | AUDIO | IMAGE | CALLOUT | VOCAB_LIST | EXERCISE | ASSIGNMENT
ExerciseKind      PRACTICE | UNIT_QUIZ | LEVEL_EXAM | PLACEMENT
QuestionType      MCQ | MULTI_SELECT | TRUE_FALSE | GAP_FILL | MATCHING | ORDERING | LISTENING_MCQ | SHORT_ANSWER
SubmissionStatus  DRAFT | SUBMITTED | IN_REVIEW | RETURNED
AttendanceStatus  PRESENT | LATE | ABSENT | EXCUSED
EnrollmentStatus  ACTIVE | COMPLETED | LOCKED
AudienceType      ALL | LEVEL | USER
```

### 3.2 Identité, accès, sécurité
| Modèle | Champs clés | Notes |
|---|---|---|
| **User** | id (cuid), email (unique, normalisé), emailVerified, name, image, role, **status**, statusReason, statusChangedAt, statusChangedById, currentLevelId?, twoFactorEnabled, failedLoginCount, lockedUntil, lastLoginAt, banned*, deletedAt, timestamps | Statut `PENDING` par défaut |
| **Account** | userId, providerId (credential/google), password (**hash Argon2id**), tokens OAuth | Géré par Better Auth |
| **Session** | id, **token (stocké haché)**, userId, expiresAt, ipAddress, userAgent, **impersonatedBy?** | Révocable individuellement ou en masse |
| **Verification** | identifier, value (haché), expiresAt | Vérif email, reset mdp |
| **TwoFactor** | userId, secret (**chiffré AES-GCM**), backupCodes (hachés) | |
| **Profile** | userId (1-1), avatarKey, country, nativeLanguage, **timezone (IANA)**, uiLocale, goals, bio, notificationPrefs (Json), privacyConsentAt, privacyPolicyVersion, marketingOptIn | |
| **LevelEnrollment** | userId, levelId, status, startedAt, completedAt, promotedById | Historique des niveaux ; base de l'accès "niveaux inférieurs validés" |
| **AuditLog** | id, actorId, impersonatorId?, action (ex. `student.approve`), targetType, targetId, metadata (Json, **sans secrets**), ip, userAgent, createdAt | Append-only (pas d'update/delete via l'app) |
| **PrivacyRequest** | userId, type (EXPORT/DELETION), status, fileKey?, processedAt | RGPD |
| **PlatformSetting** | key, value (Json), updatedById | Nom, logo, couleurs, règles d'accès, fenêtre Meet… |

### 3.3 Contenu pédagogique
| Modèle | Champs clés | Notes |
|---|---|---|
| **Level** | code (A1…), slug, name ("Discovery"…), tagline, accentColor, icon, order | 4 lignes seedées |
| **Module** | levelId, skill (SkillCode), title, description, order | unique(levelId, skill) → 16 modules |
| **Unit** | moduleId, title, slug, summary, order, status, publishAt? | |
| **Lesson** | unitId, title, slug, type, order, status, publishAt?, estimatedMinutes, xpReward | |
| **LessonBlock** | lessonId, order, kind, content (Json validé par Zod selon `kind`), videoId?, exerciseId?, assignmentId? | Une leçon = suite ordonnée de blocs → couvre TEXT, VIDEO et MIXED |
| **Video** | provider, assetId, playbackId, status, durationSec, chapters (Json), posterKey | |
| **VideoTrack** | videoId, lang (en/fr), kind (SUBTITLES/TRANSCRIPT), cues (Json horodaté) | Transcription synchronisée |
| **MediaFile** | key (R2), mime, sizeBytes, purpose, uploadedById, ownerUserId? | Toute ressource privée passe par ici |

### 3.4 Exercices, devoirs, progression
| Modèle | Champs clés | Notes |
|---|---|---|
| **Exercise** | kind, title, unitId?, levelId?, passingScore, timeLimitSec?, maxAttempts?, shuffle | Quiz d'unité, examen de niveau, test de positionnement = même moteur |
| **Question** | exerciseId, order, type, prompt, payload (Json public), **answerKey (Json, jamais envoyé au client)**, explanation, points, audioFileId? | Payload/answerKey typés par union discriminée Zod |
| **Attempt** | userId, exerciseId, startedAt, submittedAt, score, maxScore, passed | |
| **AttemptAnswer** | attemptId, questionId, response (Json), isCorrect, pointsAwarded | Correction **côté serveur uniquement** |
| **Assignment** | lessonId?, skill (WRITING/SPEAKING), prompt, minWords?, maxWords?, maxDurationSec?, rubric (Json) | |
| **Submission** | userId, assignmentId, status, text?, audioFileId?, wordCount, durationSec, version, submittedAt | Plusieurs versions si "à reprendre" |
| **Feedback** | submissionId, reviewerId, score, rubricScores (Json), comment, **annotations (Json : plages de texte + commentaire)**, audioFileId?, returnedAt | |
| **LessonProgress** | userId, lessonId, status, percent, videoPositionSec, completedAt | unique(userId, lessonId) |
| **LessonNote** | userId, lessonId, content | Notes personnelles |
| **VocabularyItem** | levelId, lessonId?, term, translation, definition, example, partOfSpeech, audioFileId? | |
| **UserVocab** | userId, itemId, état FSRS (due, stability, difficulty, reps, lapses, state, lastReviewAt) | Flashcards + répétition espacée |

Les scores par compétence (radar) sont calculés par une requête agrégée (progression leçons + moyennes quiz + notes devoirs, pondérées), mise en cache par utilisateur.

### 3.5 Cours live
| Modèle | Champs clés | Notes |
|---|---|---|
| **LiveSeries** | levelId, skill?, title, description, rrule, timezone, durationMin, createdById | Récurrence ("tous les mardis 18h") |
| **LiveSession** | seriesId?, levelId, skill?, title, description, **startsAt (UTC)**, durationMin, timezone (IANA de l'organisateur), **meetUrlEnc (chiffré)**, googleEventId?, joinWindowMin (défaut 15), status (SCHEDULED/CANCELLED/COMPLETED), replayVideoId? | Une occurrence = une ligne = **un lien unique** |
| **LiveSessionMaterial** | sessionId, mediaFileId | Supports téléchargeables |
| **Attendance** | sessionId, userId, status, markedById, joinClickedAt? | unique(sessionId, userId) ; le clic "Rejoindre" pré-remplit une présence probable |
| **ReminderLog** | sessionId, userId, kind (H24/H1), sentAt | unique → rappels **idempotents** |

### 3.6 Engagement, communication, certification
| Modèle | Champs clés |
|---|---|
| **XpEvent** | userId, amount, reason, refType, refId (registre append-only, unique(userId, reason, refId) → pas de double gain) |
| **DailyActivity** | userId, date (dans le fuseau de l'étudiant), xp → calcul du streak |
| **Badge** / **UserBadge** | code, name, description, icon, criteria (Json) / userId, badgeId, awardedAt |
| **Certificate** | userId, levelId, **serial unique** (ex. `GSA-B1-2026-7K3QX9`), issuedAt, issuedById, pdfKey, revokedAt?, revokedReason |
| **MessageThread** / **Message** | studentId (unique : 1 fil par étudiant ↔ administration) / threadId, senderId, body, readAt |
| **Announcement** | authorId, audience, levelId?, userId?, title, body, publishedAt |
| **Notification** | userId, type, payload (Json), readAt |

> La table **Progress** demandée est éclatée en `LessonProgress` + `Attempt` + `Feedback` (agrégés), plus robuste qu'une table "fourre-tout".

---

## 4. Arborescence des pages

Préfixe de langue `/fr` ou `/en` (`localePrefix: "as-needed"`, FR par défaut).

### 4.1 Public
| Route | Contenu |
|---|---|
| `/` | Hero avec globe animé, méthode, 4 niveaux, 4 compétences, déroulé des cours Meet, témoignages, FAQ, CTA "Demander mon accès" |
| `/method`, `/levels` | Pages de présentation détaillées |
| `/privacy`, `/terms`, `/cookies` | Juridique / RGPD |
| `/verify` et `/verify/[serial]` | Vérification publique d'un certificat (nom partiel, niveau, date, statut) |

### 4.2 Authentification et "portail d'attente"
| Route | Contenu |
|---|---|
| `/sign-up` | Inscription (indicateur de force, consentement RGPD, test de positionnement proposé ensuite) |
| `/sign-in`, `/two-factor` | Connexion, étape TOTP |
| `/forgot-password`, `/reset-password` | Réinitialisation |
| `/verify-email` | Confirmation d'email |
| `/pending` | "Votre demande est en cours d'examen" (+ accès au test de positionnement facultatif) |
| `/account-status` | Rejeté / suspendu (message sobre, contact) |

### 4.3 Espace étudiant (`/app`)
| Route | Contenu |
|---|---|
| `/app` | Tableau de bord (accueil, prochaine session, reprise, progression, streak, devoirs, retours) |
| `/app/learn` | Mon niveau → 4 compétences |
| `/app/learn/[skill]` | Unités de la compétence |
| `/app/learn/[skill]/[unit]` | Leçons de l'unité + quiz d'unité |
| `/app/learn/[skill]/[unit]/[lesson]` | Lecteur de leçon (blocs, vidéo, exercices, notes) |
| `/app/exam` | Examen de fin de niveau (si débloqué par l'admin) |
| `/app/assignments`, `/app/assignments/[id]` | Devoirs, soumission, correction annotée |
| `/app/vocabulary`, `/app/vocabulary/review` | Lexique, session de flashcards |
| `/app/calendar`, `/app/live/[id]` | Calendrier semaine/mois, fiche de session, replay |
| `/app/results` | Résultats, radar des compétences, historique |
| `/app/achievements` | XP, badges |
| `/app/certificates` | Certificats (téléchargement PDF) |
| `/app/messages` | Messagerie avec l'administration |
| `/app/notifications` | Notifications et annonces |
| `/app/profile`, `/app/settings/{security,notifications,privacy}` | Profil, 2FA, sessions actives, export/suppression des données |

### 4.4 Back-office (`/admin`)
| Route | Contenu |
|---|---|
| `/admin` | Dashboard (statuts, niveaux, en attente en avant, activité, complétion, assiduité, graphiques) |
| `/admin/students` | Liste filtrable/recherchable, actions rapides, export CSV |
| `/admin/students/[id]` | Onglets : profil · progression · tentatives · devoirs · présences · sessions actives · audit |
| `/admin/approvals` | File des inscriptions (approuver + niveau / rejeter) |
| `/admin/content` → `/[level]/[skill]/[unit]/[lesson]` | CMS arborescent, réordonnancement, éditeur de blocs, aperçu "vue étudiant" |
| `/admin/exercises/[id]` | Constructeur d'exercices |
| `/admin/media` | Bibliothèque vidéos/audio/PDF |
| `/admin/vocabulary` | Lexiques par niveau |
| `/admin/grading`, `/admin/grading/[submissionId]` | File de correction Writing/Speaking |
| `/admin/live`, `/admin/live/new`, `/admin/live/[id]` | Planning, création (simple/récurrente), présences, replay |
| `/admin/certificates` | Émission, révocation |
| `/admin/announcements` | Annonces (tous / niveau / étudiant) |
| `/admin/messages` | Boîte de réception |
| `/admin/audit` | Journal d'audit filtrable |
| `/admin/settings` | Plateforme, marque, règles d'accès, intégrations |

### 4.5 API (route handlers)
`/api/auth/[...all]` · `/api/uploads/presign` · `/api/media/[id]` (redirection vers URL pré-signée) · `/api/video/[id]/token` · `/api/live/[id]/join` · `/api/certificates/[id]/pdf` · `/api/cron/{reminders,publish,cleanup}` · `/api/webhooks/mux` · `/api/privacy/export`

Pages d'erreur soignées : `not-found.tsx` (404), `forbidden.tsx` (403, API `forbidden()` de Next), `error.tsx` / `global-error.tsx` (500).

---

## 5. Plan de sécurité

### 5.1 Workflow d'approbation
```
Inscription ─► email de vérification ─► statut PENDING ─► notification admin (email + in-app)
                                           │
                     ┌─────────────────────┼──────────────────────┐
                 APPROVED + niveau      REJECTED              (plus tard) SUSPENDED
                 (LevelEnrollment)      email motif           sessions révoquées + email
                 email bienvenue
```
- Toutes les transitions passent par **un seul service** `changeAccountStatus()` : vérifie que l'acteur est ADMIN, applique une machine à états (transitions autorisées), écrit l'`AuditLog`, envoie l'email, **révoque les sessions** en cas de suspension/rejet.
- Un compte non `APPROVED` n'atteint que `/pending`, `/account-status`, `/verify-email`, la déconnexion et (s'il l'active) le test de positionnement.

### 5.2 Contrôle d'accès en couches
1. **proxy.ts** : pas de cookie de session → redirection vers `/sign-in` ; locale. (Filtre d'ergonomie, pas de sécurité.)
2. **Layouts serveur** : `(student)` appelle `requireApproved()`, `(admin)` appelle `requireAdmin()` (qui exige aussi une 2FA validée).
3. **DAL** : chaque fonction de lecture/écriture reçoit un `ctx` construit **depuis la session** ; filtre systématique `where: { userId: ctx.userId }` pour les données personnelles ; `assertLevelAccess(ctx, levelId)` pour le contenu (niveau courant + niveaux `COMPLETED` si le réglage est actif) ; contenu `PUBLISHED` uniquement côté étudiant.
4. **Server Actions** : wrapper `action(schema, guard, handler)` → validation Zod + garde + rate limit + gestion d'erreurs uniforme. Impossible d'écrire une action sans garde (règle ESLint + revue).
5. **Identifiants** : cuid (non séquentiels), mais **jamais** considérés comme secrets — l'autorisation est toujours vérifiée.
6. Réponses d'erreur neutres : 404 plutôt que 403 sur les ressources d'autrui (ne pas révéler leur existence).

### 5.3 Administrateur
- 2FA TOTP **obligatoire** : un admin sans 2FA est redirigé vers l'enrôlement et n'accède à rien d'autre.
- **Impersonation** : session dédiée marquée `impersonatedBy`, durée max 30 min, bandeau rouge permanent + bouton "Quitter", entrée/sortie journalisées. Proposition : **lecture seule par défaut** (les mutations sont bloquées pendant l'impersonation) — voir questions.
- Journal d'audit : toutes les mutations admin + connexions admin + impersonations + exports CSV. IP conservée 12 mois (RGPD), puis purgée par cron.

### 5.4 Authentification
- Argon2id (`@node-rs/argon2`, paramètres OWASP : m=19 MiB, t=2, p=1), politique : 12 caractères min., vérification contre les mots de passe compromis (HIBP k-anonymity, optionnel), indicateur `zxcvbn-ts`.
- Rate limiting (Upstash) : connexion 5/min/IP+email, inscription 3/h/IP, reset 3/h/email, endpoints d'upload et d'envoi de message également limités.
- Verrouillage progressif : 5 échecs → 15 min, puis exponentiel ; message neutre ("identifiants invalides"), email d'alerte à l'utilisateur.
- Cookies `__Secure-`, HttpOnly, Secure, SameSite=Lax ; session 7 jours glissants (admin : 12 h) ; liste des sessions actives + "déconnecter tous les appareils" (étudiant et admin).
- Rotation de session à la connexion, à l'élévation 2FA et au changement de mot de passe.

### 5.5 Protections web
- **CSRF** : Server Actions protégées par Next (vérif Origin) + Better Auth (vérif Origin/trusted origins) ; route handlers mutants vérifient l'Origin.
- **En-têtes** : CSP stricte à **nonce** (scripts), `frame-ancestors 'none'`, HSTS (preload), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (micro autorisé uniquement sur les pages Speaking).
- **XSS** : le contenu TipTap est stocké en JSON ; le rendu HTML passe par une liste blanche de nœuds/marques/attributs (liens `https:` uniquement, `rel="noopener noreferrer"`), puis `sanitize-html` en défense supplémentaire. Aucun `dangerouslySetInnerHTML` sur du contenu non sanitisé.
- **Uploads** : URL pré-signée PUT avec type MIME et taille max imposés ; vérification post-upload (taille, magic bytes) ; clés aléatoires ; bucket privé ; lecture via URL GET pré-signée de 5 min générée après contrôle d'accès.
- **Vidéos** : Mux en *signed playback policy* ; jeton JWT court (durée de la vidéo + marge) émis après `assertLevelAccess` ; restriction de domaine ; MP4 téléchargeables désactivés ; **filigrane dynamique** (email de l'étudiant en surimpression discrète) pour dissuader l'enregistrement d'écran. ⚠️ Honnêteté technique : aucun système web n'empêche à 100 % une capture d'écran ; le DRM Mux (option payante) relève encore le niveau.
- **Logs** : `pino` avec redaction (`password`, `token`, `meetUrl`, `cookie`, `authorization`…). Aucun secret dans les URLs (tokens de vérification/reset à usage unique, hachés en base, expirant en 30 min/24 h).
- **Secrets** : `.env.example` documenté, validation des variables au démarrage avec Zod (`src/env.ts`), aucune valeur par défaut sensible.
- **Dépendances** : lockfile, `npm audit` en CI, Dependabot/Renovate.

### 5.6 Liens Google Meet
- Stockés **chiffrés** (AES-256-GCM, clé dans l'environnement) ; jamais présents dans le HTML ni dans l'API avant la fenêtre d'ouverture.
- Le bouton "Rejoindre" pointe vers `/api/live/[id]/join` qui vérifie : session, `APPROVED`, niveau de la session, statut `SCHEDULED`, `now ≥ startsAt − joinWindow` et `now ≤ fin` → enregistre le clic → **redirection 302** vers Meet. Le lien n'est donc jamais copiable depuis la page avant l'heure.
- Un lien par occurrence. Avec l'intégration Google Calendar, chaque occurrence est créée comme **événement distinct** (et non comme événement récurrent Google, qui partagerait le même lien Meet), avec les étudiants du niveau en invités.
- `docs/GOOGLE_MEET.md` : réglages recommandés (accès "Restreint"/réservé aux invités, salle d'attente — l'hôte admet les participants, verrouillage de la réunion, partage d'écran réservé à l'hôte, compte Google Workspace pour les contrôles de l'hôte).

### 5.7 RGPD
Consentement explicite à l'inscription (version de la politique horodatée), bannière cookies (uniquement cookies essentiels par défaut ; aucun traceur tiers), export JSON + fichiers (ZIP) à la demande, suppression = anonymisation immédiate + purge des fichiers R2 + conservation minimale légale (certificats émis : nom conservé pour la vérification, sauf demande expresse), registre des traitements en annexe de la doc.

### 5.8 Tests de sécurité automatisés
- **Intégration (Vitest + Postgres réel)** : IDOR sur chaque ressource personnelle (étudiant A ↛ données de B : progression, devoirs, notes, tentatives, messages, fichiers, notes de leçon) ; accès par niveau ; contenu brouillon invisible ; answerKey jamais sérialisé ; transitions de statut interdites ; action admin sans 2FA refusée ; impersonation lecture seule.
- **E2E (Playwright)** : inscription → vérif email → `/pending` → approbation admin → accès ; compte `PENDING`/`SUSPENDED` bloqué sur toutes les routes ; lien Meet invisible avant la fenêtre, visible pendant, inaccessible pour un autre niveau ; rate limit et lockout.

---

## 6. Design system

- **Palette** : bleu nuit `#0B1B3A` (primaire), or doux `#C9A961` (accent), blanc cassé `#FAF8F3` (fond), encre `#1A1F2E` ; mode sombre dérivé (fond `#070F22`, or légèrement éclairci). Tous les couples texte/fond vérifiés AA.
- **Accents de niveau** : A1 Discovery — émeraude ; A2 Explorer — turquoise ; B1 Navigator — indigo ; B2 Ambassador — bordeaux/pourpre. Chaque niveau a icône dédiée (boussole, longue-vue, gouvernail, globe/laurier…).
- **Typographie** : *Fraunces* (serif display élégante, titres) + *Inter* (texte), via `next/font` (auto-hébergées, pas d'appel Google Fonts à l'exécution → RGPD).
- **Tokens** en variables CSS (Tailwind v4 `@theme`), thèmes clair/sombre via `next-themes`.
- **Mouvement** : transitions 150–300 ms, `prefers-reduced-motion` respecté partout.
- **Globe du hero** : globe SVG/WebGL léger (`cobe`, ~5 ko) avec points des pays des étudiants, chargé en différé.
- États : skeletons, états vides illustrés (SVG maison), toasts et messages d'erreur humains.

---

## 7. Performance

RSC par défaut, composants client minimaux ; `next/image` ; imports dynamiques pour TipTap, l'enregistreur audio, les graphiques, le lecteur Mux et le globe ; pagination par curseur sur toutes les listes admin ; index Prisma sur les clés de filtre (`status`, `levelId`, `userId`, `startsAt`) ; cache `unstable_cache`/`use cache` avec tags invalidés lors de la publication de contenu.

---

## 8. Phases de développement

| Phase | Contenu | Démonstration en fin de phase |
|---|---|---|
| **1. Fondations** | Init Next.js/TS/Tailwind/shadcn, design system & thèmes, `env.ts`, Prisma (schéma complet + migrations), Better Auth (email/mdp, Argon2id, vérif email, reset, 2FA, sessions DB), rate limit + lockout, workflow d'approbation (PENDING → page d'attente), proxy + gardes DAL + wrapper d'actions, en-têtes de sécurité/CSP, i18n squelette, emails de base, seed (admin + niveaux + compétences), CI (lint, typecheck, tests) | Inscription → page d'attente → (approbation via seed/script) → accès ; tests d'accès |
| **2. Back-office admin** | Dashboard admin, gestion étudiants (filtres, recherche, approuver/rejeter/suspendre, niveau, reset mdp, révocation des sessions, export CSV), fiche étudiant, impersonation + bandeau, journal d'audit, notifications d'inscription | Cycle complet d'approbation par l'interface, audit consultable |
| **3. Contenu & CMS** | Niveaux/modules/unités/leçons, réordonnancement dnd, éditeur de blocs TipTap, upload R2, intégration Mux (upload, webhooks, lecture signée, sous-titres, chapitres, transcription synchronisée), brouillon/publié/programmé, aperçu étudiant, lecteur de leçon étudiant, seed de contenu démo | Créer une leçon vidéo+texte et la consulter en étudiant |
| **4. Exercices & devoirs** | Moteur d'exercices (8 types), correction serveur + explications, quiz d'unité, examen de niveau, test de positionnement, devoirs Writing (éditeur, compteur de mots) et Speaking (MediaRecorder), file de correction avec annotations et retour audio, progression et radar | Faire un quiz, soumettre un texte/un audio, le corriger côté admin |
| **5. Live Google Meet** | Sessions simples et récurrentes, calendrier semaine/mois multi-fuseaux, fenêtre de connexion, route `/join`, rappels 24h/1h (QStash), présences + stats, supports, replay, intégration Google Calendar optionnelle, doc des réglages Meet | Créer une session, la voir apparaître à l'heure locale, rejoindre à H-15 |
| **6. Espace étudiant complet** | Dashboard étudiant, XP/badges/streak, vocabulaire + flashcards FSRS, notes de leçon, messagerie, annonces/notifications, profil & préférences, certificats PDF + QR + page de vérification | Parcours étudiant complet, certificat vérifiable |
| **7. Finitions & production** | Landing page premium (globe animé), traduction FR/EN complète, PWA (Serwist), audit accessibilité (axe + clavier), RGPD (export/suppression), pages d'erreur, suite Playwright complète, README & docs, checklist de déploiement Vercel/Neon | Démo de bout en bout, rapport de tests, Lighthouse |

À la fin de chaque phase : résumé, procédure de test, étape suivante.

**Fonctionnement en local sans comptes tiers** : chaque intégration externe a un adaptateur "local" activé si les clés sont absentes — emails affichés dans la console/une boîte de réception de dev (`/dev/mailbox`), stockage sur disque local au lieu de R2, vidéo factice au lieu de Mux, rate limit en mémoire au lieu d'Upstash. Vous pouvez donc tester chaque phase avant de créer les comptes Mux/R2/Resend/Upstash.

---

## 9. Risques et limites connus

- **Capture d'écran des vidéos** : impossible à bloquer totalement sur le web (voir §5.5) ; dissuasion par filigrane et jetons courts.
- **Liens Meet** : une fois dans la réunion, un étudiant peut transmettre l'URL ; la vraie protection est côté Google (accès restreint aux invités + admission par l'hôte) — d'où l'intérêt de l'intégration Calendar.
- **Timezones / heure d'été** : stockage UTC + zone IANA de l'organisateur ; la récurrence est calculée dans la zone de l'organisateur (un cours "mardi 18h Paris" reste à 18h Paris après le changement d'heure).
- **Coûts** : Mux (à la minute stockée/visionnée), Vercel Pro recommandé en production (limites de durée des fonctions, cron), Google Workspace pour les contrôles d'hôte Meet.
