# Sécurité — GlobeSpeak Academy

État au terme de la phase 3. Chaque mesure est couverte par des tests automatisés : `tests/unit`, `tests/integration` et `tests/e2e`.

## 1. Accès sur approbation

- Tout nouveau compte, créé par email ou via Google, est un **étudiant en attente** (`PENDING`). C'est imposé dans le hook de création de Better Auth, quelles que soient les données envoyées.
- Un compte non approuvé n'accède qu'à `/pending` ou `/account-status`.
- Les changements de statut passent par une machine à états unique (`features/approval/service.ts`). Chaque changement est journalisé, notifié par email, et un rejet ou une suspension révoque toutes les sessions.

## 2. Contrôle d'accès en couches

1. Le `proxy.ts` redirige vers la connexion si aucun cookie de session n'est présent. C'est un simple filtre d'ergonomie, pas une protection.
2. Les layouts appellent `requireApprovedStudent()` ou `requireAdmin()`.
3. Chaque page, Server Action et route API revérifie les droits (`server/dal/guards.ts`). L'identifiant de l'utilisateur provient **toujours** de la session, jamais de la requête.
4. Les données personnelles sont filtrées par `userId` de session. Les contenus passent par `learnerScope()` et `accessibleLessonWhere()` (niveau accessible et contenu en ligne).
5. Une ressource d'autrui ou une zone interdite renvoie une **404**, qui ne révèle pas son existence.

Les tests d'IDOR couvrent : sessions d'un autre étudiant, leçons d'un autre niveau (même avec l'URL exacte), médias hors périmètre, réordonnancement mêlant des éléments étrangers, export CSV et flux vidéo refusés aux anonymes.

## 3. Administrateurs

- **2FA TOTP obligatoire** : sans elle, aucune page du back-office n'est accessible.
- Les sessions admin expirent après 12 h.
- Les routes HTTP du plugin admin de Better Auth (`/api/auth/admin/*`) sont **fermées**. Toute action d'administration passe par nos Server Actions, qui vérifient la 2FA et journalisent.
- **Impersonation** : session de 30 min marquée `impersonatedBy`, en **lecture seule** (gardes applicatives et hook Better Auth), avec un bandeau permanent. Impossible sur un administrateur.
- **Journal d'audit** en ajout seul : connexions admin, consultations de comptes, statuts, niveaux, sessions, exports, impersonation, contenus et médias. Aucun secret n'y figure.

## 4. Authentification

- Mots de passe : Argon2id (paramètres OWASP), 12 caractères minimum, contrôle de robustesse zxcvbn côté client et serveur.
- Vérification de l'email obligatoire. Les jetons de vérification et de réinitialisation sont stockés **hachés**, à usage unique et expirants (30 min pour une réinitialisation).
- Limitation de débit dans Postgres (Upstash en option), avec des identifiants hachés.
- Verrouillage progressif du compte : 15 min après 5 échecs, puis durée doublée, jusqu'à 24 h maximum. Un email d'alerte est envoyé.
- Sessions en base, révocables individuellement, cookies `HttpOnly`, `Secure` et `SameSite=Lax`, sans cache côté cookie : une révocation s'applique immédiatement.
- L'inscription n'est possible que via la Server Action, qui impose la validation Zod, le consentement RGPD et le contrôle de robustesse.

## 5. Protections web

- **CSP** à nonce par requête (`script-src 'nonce-…' 'strict-dynamic'`), `frame-ancestors 'none'`, `object-src 'none'`. Domaines externes limités à Mux et R2.
- **En-têtes** : HSTS, X-Frame-Options, nosniff, Referrer-Policy, COOP, Permissions-Policy (micro autorisé sur l'origine uniquement).
- **CSRF** : vérification d'origine sur les Server Actions et Better Auth (origines de confiance).
- **XSS** : le texte riche est stocké en JSON, **validé par liste blanche** (nœuds, marques, attributs, liens `http(s)` et `mailto` uniquement) et rendu en éléments React, sans HTML brut. Les sous-titres sont échappés en WebVTT.
- **Redirections** : le paramètre `next` n'accepte que des chemins internes.
- **CSV** : neutralisation de l'injection de formules (`= + - @`).

## 6. Fichiers et vidéos

- Bucket privé. Toute lecture passe par `/api/media/[id]` ou `/api/video/[id]/…` : les droits sont vérifiés, puis le navigateur est redirigé vers une URL signée de 5 minutes.
- Upload en deux temps : URL signée (type et taille plafonnés), puis confirmation serveur qui contrôle la taille et la **signature binaire**. Un fichier non conforme est supprimé ; un fichier non confirmé n'est jamais servi. Le SVG est refusé.
- Stockage local de développement : jetons HMAC expirants liés à une clé et à une opération, protection contre le *path traversal*.
- Vidéo Mux : politique de lecture **signée**, jeton émis à l'affichage après contrôle d'accès, aucun MP4 téléchargeable. Les webhooks sont vérifiés par signature.
- Dissuasion : `controlsList="nodownload"`, clic droit désactivé, **filigrane mobile** à l'adresse de l'étudiant.
- *Limite assumée* : aucun site web ne peut empêcher une capture d'écran. Le DRM Mux, en option payante, renforce la protection.

## 7. Données et secrets

- Toutes les variables sont validées au démarrage (`src/env.ts`). Aucun secret dans le code ; `.env` est ignoré par git.
- Les logs `pino` masquent mots de passe, jetons, cookies et URLs.
- Pas de donnée personnelle dans les URLs (clés de fichiers aléatoires, sans le nom d'origine).

## Rappels pour la mise en production

- Définir `APP_URL` en HTTPS. Faire tourner `BETTER_AUTH_SECRET` et `ENCRYPTION_KEY` en cas de fuite : changer `BETTER_AUTH_SECRET` invalide toutes les sessions ; changer `ENCRYPTION_KEY` rend illisibles les liens Meet déjà chiffrés.
- Retirer `SEED_ADMIN_PASSWORD` de l'environnement de production après la création du premier administrateur.
- Configurer les réglages Google Meet recommandés (phase 5 : `docs/GOOGLE_MEET.md`).
