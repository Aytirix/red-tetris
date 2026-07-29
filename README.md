# Red Piece — Red Tetris

Tetris multijoueur en temps réel, **full-stack JavaScript/TypeScript**, sur le thème
One Piece (Pirates vs Marine).

Chaque joueur a son propre plateau 10 × 20 et reçoit **exactement la même séquence de
pièces** que ses adversaires. Nettoyer *n* lignes envoie *n − 1* lignes de pénalité
indestructibles au bas du plateau des autres. Le **dernier joueur en vie gagne**.

> Pour le détail des mécaniques, des 7 modes de jeu et du barème de points :
> **[GAMEPLAY.md](GAMEPLAY.md)**.

---

## 1. Démarrage

### Prérequis

| Outil | Version | Pourquoi |
|---|---|---|
| Docker + Docker Compose | v2+ | tout tourne en conteneurs (`make dev` / `make prod`) |
| Node.js | **≥ 22.12** | uniquement pour `make test`, qui tourne **hors Docker**. Prisma 7 charge un ESM depuis du CJS et casse sur Node < 22.12 |
| GNU Make | — | raccourcis du `Makefile` |

### Configuration

```bash
cp .env.example .env
```

Le fichier `.env` est **obligatoire** : `docker-compose.yml` échoue explicitement si une
variable manque. Les valeurs par défaut de `.env.example` suffisent en local ; seuls
les identifiants Postgres/pgAdmin sont à personnaliser.

`.env` (et toute variante `.env.*`) est ignoré par Git : **aucun secret n'est versionné**,
seul `.env.example` l'est.

### Lancer le jeu

```bash
make prod     # profil production — c'est le mode de référence
```

Le serveur Node sert **lui-même** `index.html`, le bundle JS et tous les assets
statiques, sur **le même port que Socket.IO** (`$PORT`, 3000 par défaut), comme l'impose
le sujet. Une URL de partie s'écrit :

```
http://<serveur_ou_ip>:<port>/<room>/<player_name>
```

Exemple : `http://localhost:3000/dressrosa/luffy`

```bash
make dev      # profil développement — hot reload
```

En dev, le front Vite est servi **séparément** sur `http://localhost:5173`
(`PORT_DEV_FRONTEND`) avec hot-reload, et le backend reste sur `:3000` pour l'API et le
socket. Dans ce mode le backend **ne sert pas** la SPA : c'est normal, `make prod` est
le mode qui respecte l'exigence « le serveur sert index.html et le bundle ».

Le conteneur applique les migrations Prisma au démarrage : la base peut être vierge.

### Tests

```bash
make test              # les deux suites + couverture
make test-server       # serveur uniquement
make test-front        # frontend uniquement
```

Les tests tournent **sur la machine hôte**, pas dans Docker. Le `Makefile` installe les
dépendances et génère le client Prisma si nécessaire — un clone frais suffit.

| Suite | Fichiers | Tests | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|---|
| Serveur | 39 | 681 | **96,3 %** | **92,1 %** | **99,7 %** | **96,1 %** |
| Frontend | 47 | 644 | **90,4 %** | **88,8 %** | **89,4 %** | **92,3 %** |
| *Seuils sujet* | | | *70 %* | *50 %* | *70 %* | *70 %* |

Les seuils sont **imposés dans les deux `vitest.config.ts`** : la commande échoue
d'elle-même si la couverture retombe sous les minima. La CI GitHub Actions
(`.github/workflows/ci.yml`) rejoue build + tests sur chaque push et chaque PR.

### Autres commandes

```bash
make help              # liste complète
make dev-logs          # suit les logs de la stack dev
make db-reset          # reset des migrations + seed (personnages One Piece)
make db-seed-berrys    # même casting avec 500 000 berrys, sans statistiques
make down / make clean # arrêt / purge complète (volumes compris)
```

---

## 2. Conformité au sujet

| Exigence | Où c'est fait |
|---|---|
| 100 % JavaScript / TypeScript | tout le dépôt |
| Client **sans le mot-clé `this`** | `frontend/src/` — zéro occurrence, aucune classe |
| Logique de plateau/pièces en **fonctions pures** côté client | `config/gameConfig.ts`, `config/boardSizing.ts`, `socket/gameState.ts` ; tous les composants sont des fonctions |
| Serveur **orienté objet** (classes) | `Player`, `Piece`, `Game`, `Room` dans `server/src/core/` |
| Client = **framework moderne** | React 19 + hooks, composants fonctionnels uniquement |
| **SPA** | un seul `index.html`, tout le routage est client (React Router) |
| Routes `/<room>/<player_name>` | `frontend/src/router.tsx` (`createBrowserRouter`) |
| **Pas de `<table>`**, layout Grid/Flexbox | `styles.css` — 111 déclarations `display:grid` / `display:flex` |
| **Pas de Canvas, pas de SVG, pas de jQuery** | garanti par un test qui **rebuilde vraiment** puis grep le bundle : `frontend/src/build.production.test.ts` |
| Aucune manipulation directe du DOM | seule exception : le montage React sur `#root` |
| HTTP + **socket.io** | `server/src/app.ts` (Express) + `gateways/socket/` |
| Le serveur sert `index.html`, le bundle et les assets | `server/src/app.ts` (`express.static` + fallback SPA) |
| Distribution des pièces par le serveur | `Game.pieceQueue` — sac de 7 partagé, chaque joueur a son `pieceIndex` |
| Spectres adverses temps réel | `gameEmitters.getSpectrumBoard()` — hauteur par colonne, sans couleur ni trou |
| Pénalités *n − 1*, indestructibles | `Game.addPenaltyToOpponents()` / `createPenaltyLine()` |
| Verrouillage à la frame suivante | `Game.getLockGraceMs()` — 1,75 frame de gravité, ≥ le minimum du sujet |
| Hôte = premier arrivé, transmis s'il part | `Room.addPlayer()` / `Room.removePlayer()` |
| Aucun join après le coup d'envoi | `Room.canJoin()` (statut `waiting` requis) |
| Solo **et** multi | rooms solo dédiées (`sologame_*`) et rooms multi |
| Parties simultanées | `roomSocketStore` — N rooms indépendantes, une boucle de gravité chacune |
| Couverture ≥ 70 / 50 % | voir tableau ci-dessus |
| Aucun secret dans le dépôt | `.gitignore` : `.env*` sauf `.env.example` |

Bonus implémentés (chapitre VI du sujet) : système de score, persistance des scores et
statistiques, **7 modes de jeu**, boutique de thèmes, spectateurs, classements.

---

## 3. Stack

**Frontend** — React 19, TypeScript, Vite 6, React Router 7, Sass, Tailwind 4,
socket.io-client, react-spinners.
Pas de Redux : l'état global tient dans des **contextes React** (`SocketContext`,
`WsStateContext`, `ShopContext`, `TransitionContext`) plus des modules de normalisation
sous `src/socket/`.

**Backend** — Node.js, Express 5, Socket.IO 4, Prisma 7 + PostgreSQL 18.

**Tests** — Vitest (les deux côtés), React Testing Library, couverture V8.

**Infra** — Docker / Docker Compose (profils `dev` et `prod`), image de production
mono-conteneur (`Dockerfile.prod`), GitHub Actions.

---

## 4. Architecture

```
red-tetris/
├── server/
│   └── src/
│       ├── core/            Player, Piece, Game, Room  ← toute la logique de jeu
│       ├── gateways/socket/ handlers, emitters, validators, stores
│       ├── services/        room, player, shop, stats, user
│       ├── repositories/    accès Prisma
│       ├── config/          constantes, CORS, thèmes boutique
│       ├── app.ts           Express : statique + fallback SPA
│       └── server.ts        bootstrap HTTP + socket
├── frontend/
│   └── src/
│       ├── components/game/ GameView, GameBoard, Cell, MiniBoard, HUD…
│       ├── pages/           Home, Dashboard, Game, Stats…
│       ├── socket/          émetteurs + normalisation des payloads
│       ├── contexts/        état global (React Context)
│       ├── config/          formes, thèmes, touches, dimensionnement
│       └── router.tsx       routes SPA
└── sujet/                   énoncé PDF (FR + EN)
```

### Répartition des responsabilités

Le **serveur est autoritaire** : il détient les plateaux, la file de pièces, la
gravité, les collisions, les rotations, les pénalités et la condition de victoire.

Le **client n'est qu'un afficheur** : il envoie des *intentions* (`game:move`,
`game:rotate`, `game:drop`, `game:joker`) et rend l'état reçu. Il ne simule rien — il ne
peut donc pas tricher.

### Protocole réseau

28 événements documentés dans `server/ws-docs.json`, consultables dans l'app en dev
(bouton ⚙ → « Docs WS », route `/docs-ws`, absente du bundle de production).

| Groupe | Client → Serveur | Serveur → Client |
|---|---|---|
| user | `user:CheckUsernameAvailable`, `user:Register` | `user:ResultUsernameAvailable`, `user:ResultRegister` |
| room | `room:join`, `room:leave`, `room:kick`, `room:setMode`, `room:setPrivate`, `room:start`, `room:restart`, `room:subscribeList` | `room:joined`, `room:players`, `room:settings`, `room:left`, `room:kicked`, `room:denied`, `room:list` |
| game | `game:move`, `game:rotate`, `game:drop`, `game:joker`, `game:subscribeSpectatorGame` | `game:start`, `game:update`, `game:over`, `game:eliminated`, `game:countdown`, `game:SpectatorGame` |
| shop / stats | `shop:Get`, `shop:Buy`, `shop:Equip`, `stats:Get` | `shop:State`, `shop:Error`, `stats:State` |
| système | — | `system:Error` |

Les événements sans argument (`room:start`, `room:leave`, `game:rotate`, `game:drop`…)
acceptent une absence de payload, `null` ou `{}` — et rejettent tout payload porteur de
données non validées (`isEmptyPayload`).

---

## 5. Base de données

Le sujet n'exige **aucune persistance**, et le gameplay temps réel n'en utilise
aucune : plateaux, pièces et parties vivent **intégralement en mémoire serveur**.

PostgreSQL ne sert qu'aux bonus, en dehors de la boucle de jeu : comptes (pseudo,
faction, avatar), berrys et thèmes possédés, historique des parties (`GameRecord`) et
agrégats de statistiques. Une partie se déroule de bout en bout sans qu'une seule
requête ne touche la base pendant le jeu.

---

## 6. Documentation

- **[GAMEPLAY.md](GAMEPLAY.md)** — mécaniques détaillées, 7 modes de jeu, barème de
  points, pénalités, boutique, statistiques.
- **[docs/correction-gab.md](docs/correction-gab.md)** et
  **[docs/correction-theo.md](docs/correction-theo.md)** — qui a fait quoi, technos et
  questions attendues en soutenance.
- `server/ws-docs.json` — protocole websocket complet (rendu dans l'app en dev).
- `sujet/fr.subject.pdf`, `sujet/en.subject.pdf` — l'énoncé.
