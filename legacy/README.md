# Fluxia — Prototype interactif

Vanilla JS en modules ES, sans étape de build. À lancer via un serveur HTTP
(ex. extension **Live Server** de VS Code) : les modules ES ne se chargent pas en `file://`.

## Structure

```
index.html            Coquille HTML (sidebar, topbar, contenu, modales, toast)
css/
  base.css            Tokens (variables), reset, utilitaires
  layout.css          Sidebar, topbar, grilles, responsive
  components.css      Styles des composants
js/
  main.js             Bootstrap : store + routeur + rendu + délégation d'événements
  core/               html`` (templates échappés), store, routeur hash, toast
  data/               Données mockées (clients, techniciens, emails, planning, devis…)
  state/              État initial, sélecteurs (valeurs dérivées), actions
  components/         Composants UI réutilisables (Button, Card, Pill, KeyValue…)
  layout/             Sidebar, Topbar
  pages/              Une page par fichier + registre (pages/index.js)
  modals/             Modales + registre (modals/index.js)
```

## Principes

- **Un seul état** (`state/initialState.js`) ; toute modification passe par `store.set()`, ce qui re-rend l'UI.
- **Compteurs dérivés** dans `state/selectors.js` plutôt que modifiés à la main.
- **Actions déclaratives** : un élément `data-action="nomAction"` appelle `actions.nomAction(ctx, dataset)`.
- **Navigation** par hash (`#/inbox`) : liens `<a href="#/page">` ou `Button({ href: 'page' })`.

## Ajouter une page

1. Créer `js/pages/ma-page.js` exportant `{ id, nav, title?, badge?, render(state) }`.
2. L'ajouter à la liste dans `js/pages/index.js` (elle apparaît dans la sidebar).

## Ajouter une modale

1. Créer `js/modals/MaModale.js` (utilise le composant `Modal`).
2. La déclarer dans `js/modals/index.js`, puis l'ouvrir avec
   `Button({ action: 'openModal', data: { modal: 'maModale', id: '…' } })`.
