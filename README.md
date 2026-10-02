# Fluxia

Le bureau administratif IA des entreprises de maintenance (CVC, plomberie, électricité).
**L'IA propose, vous décidez** : chaque demande entrante devient une intervention planifiée,
un rapport client et, si nécessaire, un devis — avec une validation humaine à chaque étape clé.

| | |
|---|---|
| `apps/web` | Next.js 16 (App Router, Server Components, Server Actions) |
| `apps/api` | NestJS 12 + Prisma (SQLite en dev, PostgreSQL en prod) |
| `legacy/` | Ancien prototype HTML (référence) |

## Démarrage

Prérequis : Node.js ≥ 22.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm install          # installe les deux apps et génère le client Prisma
npm run db:setup     # crée la base SQLite et charge les données de démo
npm run dev          # API sur :4000, web sur http://localhost:3000
```

`npm run db:reset` remet la base à zéro (les données de démo sont relatives à la date du jour).

### IA

Par défaut, un **moteur heuristique local** (règles déterministes, sans clé) analyse les demandes et rédige les rapports.
Pour utiliser **Claude** (`claude-opus-5-5`), renseignez la clé dans `apps/api/.env` :

```
ANTHROPIC_API_KEY=sk-ant-...
```

En cas d'erreur de l'API Claude, Fluxia bascule automatiquement sur le moteur local (le moteur utilisé est tracé).
`AI_PROVIDER=heuristic` force le moteur local.

## Parcours

1. **Inbox IA** — une demande arrive (email, formulaire…). L'IA la qualifie (catégorie, priorité, symptômes, équipement) ;
   le client, le site et l'équipement sont rattachés par des règles déterministes (email, domaine, nom). Tout est corrigeable.
2. **Intervention** — créée depuis la demande. Le moteur de planification classe les techniciens
   (compétence 35 · disponibilité réelle 30 · trajet 20 · historique 15) et propose un créneau sans conflit.
3. **Mission** — envoyée au technicien ; le client reçoit une confirmation (messages simulés et tracés).
4. **Vue terrain** — le technicien dicte ou tape son compte rendu ; l'IA rédige le rapport et liste les pièces.
5. **Facturation** — une règle déterministe compare les pièces / main d'œuvre / déplacement au contrat en vigueur.
6. **Devis** — brouillon généré avec les prix du catalogue ; validation obligatoire avant envoi.

## Règles métier garanties par l'API

- Cycles de vie contrôlés (`src/common/state-machine.ts`) : une mission ne peut pas être envoyée sans affectation,
  un rapport ou un devis ne peut pas être envoyé sans validation.
- Aucun chevauchement de planning (marge de 15 min), créneaux entre 8 h et 18 h, jamais dans le passé.
- Un devis avec une ligne à 0 € ne peut pas être validé.
- Montants en centimes, totaux HT / TVA / TTC calculés côté serveur.
- Journal d'audit : chaque action (IA, responsable, technicien) est enregistrée et affichée.

## Architecture

```
apps/api/src
  common/        vocabulaire métier, machines à états, dates, géo
  ai/            AiProvider : heuristic.provider, claude.provider, ai.service (sélection + repli)
  planning/      scheduler.ts (fonctions pures, testées) + planning.service
  requests/      Inbox : ingestion, analyse, correction, conversion
  interventions/ cycle de vie, affectation, mission, compte rendu
  reports/       rapports + billing.ts (règle de facturation, testée)
  quotes/        devis, lignes, validation, envoi
  clients/ technicians/ catalog/ activity/ dashboard/

apps/web/src
  app/           routes (une page = un fichier) + actions.ts (toutes les mutations)
  components/    ui/ (Badge, Card, ActionButton, Toast…) et layout/
  features/      composants par domaine (inbox, interventions, planning, reports, quotes…)
  lib/           api.ts (client HTTP serveur), types.ts, format.ts (libellés FR)
```

Le navigateur ne parle jamais directement à l'API : les pages sont rendues côté serveur et
les mutations passent par des Server Actions, qui revalident l'interface après chaque action.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | API + web en parallèle |
| `npm test` | tests unitaires de l'API (Vitest) |
| `npm run typecheck` | vérification TypeScript des deux apps |
| `npm run build` | build de production |
| `npm run db:studio -w api` | explorer la base (Prisma Studio) |

## Prochaines étapes suggérées

- Authentification et rôles (responsable / technicien) — point d'entrée prévu dans `app/actions.ts`.
- PostgreSQL en production (`provider = "postgresql"` dans `schema.prisma`).
- Connecteurs réels : boîte mail entrante (IMAP / webhook), envoi d'emails (SMTP), SMS.
- Application mobile technicien (PWA) à partir de la vue terrain.
- Export PDF des rapports et devis, puis facturation.
