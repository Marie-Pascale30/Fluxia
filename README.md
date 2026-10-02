# Fluxia

Le bureau administratif IA des entreprises de maintenance (CVC, plomberie, électricité).
**L'IA propose, vous décidez** : chaque demande entrante devient une intervention planifiée,
un rapport client, un devis puis une facture, avec une validation humaine à chaque étape clé.

| | |
|---|---|
| `apps/web` | Next.js 16 (App Router, Server Components, Server Actions, application installable et hors ligne) |
| `apps/api` | NestJS 12 + Prisma 6 + PostgreSQL 17 |
| `packages/shared` | Contrat partagé (`@fluxia/shared`) : vocabulaire métier et schémas Zod des réponses de l'API |
| `legacy/` | Ancien prototype HTML (référence) |

## Démarrage

Prérequis : Node.js ≥ 24, Docker (pour PostgreSQL).

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm install          # installe le monorepo, construit @fluxia/shared, génère le client Prisma
npm run db:up        # PostgreSQL sur localhost:5434 (bases fluxia, fluxia_test, fluxia_e2e)
npm run db:setup     # applique les migrations et charge les données de démo
npm run dev          # shared + API sur :4000 + web sur http://localhost:3000
```

Comptes de démonstration (mot de passe `fluxia-demo`) :

| Compte | Rôle |
|---|---|
| `julien@fluxia.fr` | Responsable : accès complet |
| `thomas.martin@fluxia.fr`, `marc.lefevre@fluxia.fr`, `sophie.dubois@fluxia.fr` | Technicien : vue terrain et rapports de ses missions |

`npm run db:reset` remet la base à zéro (les données de démo sont relatives à la date du jour).
`npm run db:migrate -- --name <nom>` crée une migration après modification de `apps/api/prisma/schema.prisma`.

## Fonctionnalités

1. **Inbox IA** : les demandes arrivent par email (webhook ou relève IMAP), formulaire ou saisie. L'IA qualifie la demande
   (catégorie, priorité, symptômes, équipement, coordonnées) et le client est rattaché par des règles déterministes.
   Pour un nouveau contact, on crée le client en un clic. Une réponse peut être rédigée par l'IA puis envoyée.
2. **Planification** : les techniciens sont classés selon quatre critères (compétence 35, disponibilité réelle 30,
   trajet 20, historique 15), avec un créneau proposé sans conflit. Le planning offre une vue jour et une vue semaine,
   avec glisser-déposer.
3. **Vue terrain** (PWA installable) : le technicien dicte son compte rendu (dictée du navigateur ou transcription serveur),
   ajoute des photos et fait signer le client. Le brouillon reste conservé sur l'appareil, et une action lancée hors ligne
   est rejouée au retour du réseau.
4. **Rapports et devis** : rapport rédigé par l'IA, règle de facturation comparée au contrat, devis préparé avec les prix
   du catalogue. Ces documents sont exportés en PDF, et leur validation est obligatoire avant tout envoi.
5. **Portail client** : lien signé et révocable, qui donne accès au suivi des interventions, aux documents et à
   l'acceptation ou au refus des devis en ligne.
6. **Entretien préventif** : les visites dues selon la périodicité des contrats sont programmées automatiquement
   (tâche planifiée idempotente).
7. **Facturation** : factures créées depuis un rapport ou un devis, numérotées sans trou à l'émission (`F-AAAA-NNNN`),
   avec avoirs (`A-AAAA-NNNN`), suivi des paiements et des retards, et export CSV du journal des ventes (411 / 706 / 4457).
8. **Envois** : emails et SMS passent par une file d'envoi (outbox) qui gère les relances, la trace des envois et la
   reprise manuelle.

## Configuration

Toutes les variables sont décrites dans [apps/api/.env.example](apps/api/.env.example). Sans configuration,
tout fonctionne en local : messages simulés et tracés, moteur IA heuristique, fichiers dans `apps/api/storage`.

| Besoin | Variables |
|---|---|
| IA Claude (`claude-opus-5-5`) | `ANTHROPIC_API_KEY` (repli automatique sur le moteur local ; `AI_PROVIDER=heuristic` le force) |
| Emails sortants | `SMTP_URL`, `MAIL_FROM` |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| Emails entrants | `INBOUND_EMAIL_TOKEN` (webhook `POST /api/inbound/email?token=…`) ou `IMAP_URL` |
| Transcription audio | `TRANSCRIPTION_URL`, `TRANSCRIPTION_API_KEY`, `TRANSCRIPTION_MODEL` (API compatible OpenAI) |
| Documents et factures | `COMPANY_*`, `PAYMENT_TERMS_DAYS`, `ACCOUNT_*` |
| Liens du portail | `PUBLIC_WEB_URL` |
| Sécurité | `JWT_SECRET` (obligatoire en production), `LOGIN_RATE_LIMIT` |

## Règles métier garanties par l'API

- Les cycles de vie sont contrôlés (`src/common/state-machine.ts`) : une mission ne peut pas partir sans affectation,
  et un rapport ou un devis ne peut pas être envoyé sans validation.
- Le planning n'accepte aucun chevauchement (marge de 15 min) et propose des créneaux entre 8 h et 18 h, jamais dans le passé.
- Les dates sont calculées dans le fuseau de l'entreprise (`APP_TIMEZONE`), quel que soit le fuseau du serveur.
- La numérotation est atomique (interventions, devis, factures) et sans trou pour les factures.
- Les rôles sont vérifiés côté serveur : un technicien n'accède qu'à ses propres missions.
- Les montants sont stockés en centimes, et les totaux HT / TVA / TTC sont calculés côté serveur.
- Un journal d'audit enregistre chaque action, qu'elle vienne de l'IA, d'un responsable, d'un technicien ou d'un client.

## Architecture

```
packages/shared/src  domain.ts (vocabulaire), contract.ts (schémas Zod des réponses)

apps/api/src
  common/        dates (fuseau), machines à états, numérotation, secrets, géo
  auth/          JWT, garde globale, rôles, contexte de requête
  ai/            AiProvider : heuristic.provider, claude.provider, ai.service (sélection + repli)
  planning/      scheduler.ts (fonctions pures, testées) + planning.service
  requests/      Inbox : ingestion, analyse, création client, réponses
  interventions/ cycle de vie, affectation, mission, compte rendu, signature
  reports/ quotes/ invoices/   documents, règle de facturation, comptabilité
  messaging/     outbox, transports SMTP / Twilio, webhook entrant, relève IMAP
  attachments/ storage/ pdf/   photos, audio, signatures, PDF
  portal/ maintenance/         portail client, entretien préventif
  clients/ technicians/ catalog/ activity/ dashboard/

apps/web/src
  app/           routes ((app) espace connecté, (auth) connexion, portail/) + actions.ts (mutations)
  components/    ui/ (ActionButton, Toast…) et layout/ (Sidebar, Topbar, connectivité)
  features/      composants par domaine (inbox, field, planning, documents, portal…)
  lib/           api.ts (client HTTP serveur), session, format.ts (libellés FR)
```

Le navigateur ne parle jamais directement à l'API : les pages sont rendues côté serveur, les mutations passent
par des Server Actions, et les fichiers (photos, PDF) transitent par des routes du web qui vérifient la session.

## Tests

| Commande | Effet |
|---|---|
| `npm test` | tests unitaires de l'API (Vitest, exécutés en fuseau America/New_York) |
| `npm run test:e2e -w api` | tests HTTP de bout en bout : API compilée sur :4610, base `fluxia_test`, réponses validées par le contrat partagé |
| `npm run test:e2e -w web` | tests navigateur (Playwright) sur une pile isolée, voir ci-dessous |
| `npm run typecheck` | vérification TypeScript des trois paquets |

Pile isolée des tests navigateur (base `fluxia_e2e`, réinitialisée avant chaque exécution) :

```bash
node scripts/e2e-api.mjs                                          # API de test sur :4005
cd apps/web && API_URL=http://localhost:4005/api npx next dev -p 3005
PW_CHANNEL=msedge npm run test:e2e -w web                         # ou chrome ; sans variable : Chromium de Playwright
```

La CI GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) exécute les vérifications, les tests,
les tests navigateur et la construction des images Docker.

## Déploiement (Docker)

```bash
cp .env.prod.example .env.prod      # secrets, URL publique, connecteurs
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm seed   # données de démo (facultatif)
```

L'API applique les migrations à son démarrage et conserve les fichiers déposés dans le volume `uploads`.
Le web (sortie Next « standalone ») est exposé sur `WEB_PORT` (3000 par défaut). Placez un proxy HTTPS devant.

> Sous Windows, si le dépôt est synchronisé par OneDrive, Docker peut refuser de lire certains fichiers
> (« invalid file request ») : construisez depuis une copie du dépôt hors OneDrive, par exemple
> `git clone . C:\build\fluxia` puis `docker build` dans ce dossier.
