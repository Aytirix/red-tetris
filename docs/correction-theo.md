# Fiche correction — Théo

> Antisèche perso pour la soutenance. Ce que **tu** as construit, où ça vit, et les
> questions qui vont tomber dessus.
> Vue d'ensemble : [README](../README.md) · mécaniques : [GAMEPLAY](GAMEPLAY.md)

---

## 1. Ton rôle en une phrase

Tu as fait **100 % du frontend**, la moitié haute du moteur de jeu (rotations, wall
kicks, lock delay, les 7 modes), toute la couche bonus (boutique, statistiques,
spectres, jokers), les **tests des deux côtés**, et l'infra de déploiement (Docker prod,
CI, Coolify).

Répartition indicative en lignes encore présentes dans le code :

| Zone | toi | Gab |
|---|---|---|
| `frontend/src/` (tout) | **~8 000** | 0 |
| `server/src/core/` | **819** | 469 |
| `server/src/gateways/` | 706 | 738 |
| `server/src/repositories/` | **257** | 25 |
| `server/prisma/` | **444** | 63 |

---

## 2. Ce que tu as écrit

### Frontend — intégralité

- **React 19 + TypeScript + Vite 6** — mise en place complète, `main.tsx`,
  `router.tsx` (`createBrowserRouter`), `layouts/RootLayout.tsx`.
- **Pages** — `HomePage` (inscription faction Pirate/Marine + avatars),
  `DashboardPage` (scène parallaxe animée, liste des rooms), `GamePage`, `ThemePage`,
  `DocsWsPage`, `NotFoundPage`, `RouteErrorPage`.
- **Vue de jeu** — `components/game/` : `GameView`, `GameBoard`, `Cell`, `MiniBoard`
  (spectres adverses), `GameHud`, `NextPiecePreview`, `OpponentsColumn`,
  `ControlsLegend`, `GameOverView` (podium).
- **État global sans Redux** — `SocketContext`, `WsStateContext`, `ShopContext`,
  `TransitionContext`, plus les modules de normalisation `src/socket/` (`gameState`,
  `userState`, `shopState`, `statsState`) qui traduisent chaque payload serveur en état
  React typé.
- **Confort** — préchargement des images (`preload/bootPreload.ts`), transitions nuages
  (`CloudTransition`), décompte 3-2-1, plateau responsive (`config/boardSizing.ts`),
  **touches configurables** (`config/keyBindings.ts` + `KeyBindingsScreen`), légende des
  contrôles adaptée à la disposition clavier réelle (`hooks/useKeyLabel.ts`).

### Serveur — moteur de jeu avancé

- **Rotations & wall kicks** — boîtes englobantes carrées, kicks latéraux **et
  verticaux** (floor kicks), dans `Game.ts`.
- **Lock delay + lock grace** — une pièce au contact ne se fige pas instantanément, elle
  a un sursis (`getLockGraceMs()`), ce que le sujet exige.
- **Détection du sur-place** (`deepestY`) — le fix du bug de la rotation spammée : le
  kick vertical décollait la pièce et relançait le sursis à l'infini, elle ne se
  verrouillait **jamais**. Le sursis ne repart maintenant que si la pièce atteint une
  rangée où elle n'était jamais passée. Test : `core/Game.lockreset.test.ts`.
- **Auto-repeat DAS/ARR** sur les déplacements tenus.
- **Score de descente** : 1 point/case en soft drop, 2 en hard drop.
- **Les 7 modes** — classique, sprint, ultra, sudden death, invisible, cascade, gruyère.
  Cascade (retombée par amas + chaînes) et gruyère (rangées trouées + remontée du
  plateau) sont les deux plus techniques.
- **Jokers** du mode invisible (`MAX_JOKERS = 3`).
- **Spectres adverses** — `gameEmitters.getSpectrumBoard()` : hauteur de pile par
  colonne, sans couleur ni trou, exactement ce que décrit le sujet.

### Bonus & persistance

- **Boutique** (`services/shopService.ts`, `config/shopThemes.ts`, `ShopScreen.tsx`) —
  berrys gagnés en jouant, thèmes de pièces achetables et équipables.
- **Statistiques** (`services/statsService.ts`, `repositories/statsRepositories.ts`,
  `StatsScreen.tsx`) — historique `GameRecord` + agrégats, écrits en best-effort hors
  boucle de jeu.
- Extension du schéma Prisma : `berrys`, `equippedTheme`, `ownedThemes`.

### Tests & infra

- **1 334 tests** au total (688 serveur + 646 frontend), seuils de couverture imposés
  dans les deux `vitest.config.ts` : la commande échoue d'elle-même sous les minima.
- **`build.production.test.ts`** — le test le plus malin du repo : il relance un vrai
  `vite build` et grep le bundle pour prouver qu'il ne contient **ni canvas, ni SVG, ni
  jQuery**. Ce n'est pas une promesse, c'est vérifié à chaque run.
- **CI GitHub Actions** (`.github/workflows/ci.yml`) — build + tests des deux côtés sur
  chaque push et chaque PR.
- **`Dockerfile.prod` mono-conteneur** — build de la SPA puis image Node unique qui sert
  `index.html`, le bundle et le socket **sur la même origine et le même port**.
- `Makefile`, `docker-compose.yml` (profils `dev` / `prod`), seeds One Piece.

---

## 3. Technos que tu dois savoir défendre

| Techno | Ce que tu en dis |
|---|---|
| **React 19 + hooks** | composants **fonctionnels uniquement**, zéro classe → zéro `this` |
| **TypeScript** | types partagés entre les deux côtés, `tsc --noEmit` propre |
| **Vite 6** | dev server + HMR, build de prod |
| **React Router 7** | `createBrowserRouter`, routes `/:room/:player_name` |
| **Contextes React** | remplacent Redux : l'état global tient dans 4 providers |
| **Tailwind 4 + Sass** | utilitaires + styles composants, **Grid/Flexbox** partout |
| **socket.io-client** | un seul socket partagé via `SocketContext` |
| **Vitest + React Testing Library** | tests des deux côtés, couverture V8 |
| **Docker multi-stage** | build SPA isolé du runtime |

---

## 4. Questions probables du correcteur

**« Montre-moi qu'il n'y a pas de `this` dans le client. »**
→ `grep -rn '\bthis\b' frontend/src` → rien. Aucune classe, que des fonctions.
Le seul endroit qui en aurait eu besoin (la répétition de touche dans `GameView.tsx`)
est une **closure** : `makeRepeater()` renvoie `{ start, stop }` et garde ses timers dans
des variables capturées.

**« Où sont tes fonctions pures ? »**
→ `config/gameConfig.ts`, `config/boardSizing.ts`, `config/keyBindings.ts`,
`socket/gameState.ts`. Entrée → sortie, aucun effet de bord, aucun état caché.

**« Prouve qu'il n'y a ni canvas ni SVG. »**
→ Lance `npm test` dans `frontend/` : `build.production.test.ts` **rebuild** le projet
et grep le bundle. Le test échoue si l'un d'eux réapparaît.

**« Pourquoi pas Redux ? »**
→ Le sujet le suggère, il ne l'impose pas. L'état global tient dans quatre contextes ;
ajouter Redux aurait été de la cérémonie pour rien. Ce qui compte — un flux
unidirectionnel serveur → état → rendu — est respecté.

**« Le layout, c'est du Grid ou du Flexbox ? »**
→ Les deux, jamais de `<table>` : 121 déclarations `display:grid` / `display:flex` dans
les feuilles de style, dont 111 dans `styles.css`.
Le plateau est une grille CSS de 10 × 20 `<div>`.

**« Une URL de partie ? »**
→ `http://localhost:3000/dressrosa/luffy` — `/<room>/<player_name>`, résolu côté client
par React Router. Un seul `index.html`, c'est une vraie SPA.

**« Comment le serveur sert-il le front ? »**
→ En prod uniquement : `app.ts` fait `express.static` sur `frontend-dist` + fallback SPA,
sur le **même port** que Socket.IO. En dev, Vite sert le front à part sur `:5173` pour le
hot reload.

**« Explique-moi un mode de jeu compliqué. »**
→ **Cascade** : après un nettoyage, on découpe le plateau en amas de cellules soudées,
chaque amas retombe jusqu'à reposer sur quelque chose, et si ça complète de nouvelles
lignes on recommence — c'est une chaîne, et chaque maillon multiplie le score.
→ **Gruyère** : 10 rangées trouées d'une case au départ, 20 à creuser au total, le
plateau remonte d'une rangée toutes les 2 rangées creusées.

**« Ta couverture ? »**
→ Serveur 96,3 / 92,1 / 99,7 / 96,1 %. Frontend 90,4 / 88,8 / 89,4 / 92,3 %.
Le sujet demande 70 / 50 / 70 / 70. Les seuils sont **dans la config** : ça casse tout
seul si ça retombe.

---

## 5. Les pièges à connaître

- **`make dev` ne sert pas la SPA depuis le backend** — c'est normal, Vite s'en charge.
  Si le correcteur veut vérifier l'exigence « le serveur sert index.html », c'est
  **`make prod`**.
- **Node ≥ 22.12 obligatoire** pour `make test` (Prisma 7). Docker est en node:24.
- **`.env` n'est jamais versionné** — `.gitignore` a `.env*` avec `!.env.example`.
  Le sujet fait échouer le projet en cas de fuite de secret.
- **`/docs-ws`** (les 28 événements websocket) n'existe qu'en dev, jamais dans le bundle
  de prod.
