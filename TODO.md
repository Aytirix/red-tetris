# Red Tetris — Suivi de conformité au sujet

> Audit du code (branche `theo`, commit `02ede87`) contre `sujet/en.subject.pdf` **v5.2**, réalisé le **2026-07-22**.
> Légende : ✅ conforme · ⚠️ partiel · ❌ manquant ou violation.
> Ce fichier est le tableau de bord du reste à faire. À mettre à jour au fil des corrections.

---

## Verdict global

| | Audit initial | Après corrections du 2026-07-22 |
|---|---|---|
| ✅ Conformes | 22 / 34 | **28 / 34** |
| ⚠️ Partiels | 5 / 34 | 5 / 34 |
| ❌ Manquants / violations | 7 / 34 | **1 / 34** |

**Corrigé le 2026-07-22** : Canvas supprimé, SVG supprimés, tests unitaires, le serveur sert la SPA, spectre des adversaires, erreur de compilation TypeScript, bug de démarrage de partie (B1).

**Correction d'audit** : le **lock delay était déjà conforme** — la première analyse était fausse (voir P1-7).

**Plus aucun point éliminatoire.** Il reste **une** mécanique obligatoire : les lignes de pénalité (en cours côté équipe).

### Boucle d'audit adversarial du 2026-07-22 (3 itérations, 6 auditeurs indépendants)

Quatre auditeurs sur le diff initial, puis deux auditeurs de vérification sur les correctifs.
**1104 tests** au total (serveur 476 · frontend 628), toutes les mutations de contrôle tuées.

Corrigés pendant la boucle :

| Sévérité | Défaut | Correctif |
|---|---|---|
| 🔴 Bloquant | **Le build de production était un build de développement** (`NODE_ENV=development` du `.env` racine capté par `loadEnv`) → `dist/` embarquait la page `/test`, `@mediapipe`, `createElement("canvas")`, `webgl2` et `jsxDEV` | `delete process.env.VITE_USER_NODE_ENV` dans `vite.config.ts` + test de build réel |
| 🔴 Bloquant | `game:subscribeSpectatorGame` sans contrôle : un joueur **vivant** s'abonnait à sa propre partie et recevait les plateaux réels → spectre contourné | refus si `isAlive` (`roomHandlers.ts`) |
| 🔴 Bloquant | Le profil prod n'appliquait **jamais** les migrations Prisma → `P2021 TableDoesNotExist`, jeu injouable sur machine fraîche | `server/docker/entrypoint.prod.sh` + `ENTRYPOINT` |
| 🟠 Majeur | Le mot-clé `this`, interdit par le sujet, réintroduit dans `frontend/src` par une classe utilitaire de test | réécrite en closure ; `grep -rnw this frontend/src` ne renvoie plus que des commentaires |
| 🟠 Majeur | Les correctifs du chevron et du spectre CSS n'avaient **aucun** garde-fou (3 mutations survivantes) | `chevronGeometry.ts` extrait en module pur + 7 tests, `styles.spectrum.test.ts` + 5 tests ; les 3 mutations sont désormais tuées |
| 🟠 Majeur | Couverture frontend mensongère : `coverage.include` trié à la main, **19,5 %** de couverture réelle sur `src/**` | périmètre élargi à `src/**` + 19 fichiers de test (+230 tests) → **90,6 / 88,7 / 89,6 / 92,0** |
| 🟠 Majeur | `express.static` non testé : le supprimer ne faisait échouer **aucun** test | `app.http.test.ts`, 8 requêtes HTTP réelles |
| 🟠 Majeur | `room:kick` en pleine partie gelait la victime (gravité active, plus aucun contrôle) | refus hors `waiting` |
| 🟠 Majeur | Double `room:join` du même socket → `Room.players` désync de `Game.state` → fin de partie au 1ᵉʳ verrouillage | `Room.addPlayer` refuse les doublons + leave implicite sur changement de room |
| 🟠 Majeur | leave/disconnect en partie : room supprimée mais `setInterval` toujours actif, frames envoyées à des partis | `Game.abandon()` + purge des abonnements spectateur |
| 🟠 Majeur | Fallback SPA : asset manquant → `200 text/html` → `Failed to load module script`, app blanche | 404 si le chemin a une extension |
| 🟠 Majeur | `pgadmin` (console d'admin DB) démarré par le profil **prod** | `profiles: [dev]`, `db` en `127.0.0.1`, `restart` sur `backend-prod` |
| 🟠 Majeur | Chevron non iso-visuel : `linecap` rond émulé par un `border-radius` de coin (quart de rond asymétrique) | géométrie redérivée du tracé SVG + disques aux extrémités |
| 🟠 Majeur | Spectre adverse rendu **en cyan de pièce I** (aucune règle `data-piece="spectrum"`) | règle monochrome dédiée, exclue des 4 recipes de thème |
| 🟡 Mineur | `room:setMode`/`setPrivate` modifiables en pleine partie ; `checkGameOver` non idempotent ; `Game.players` alias mutable de `Room.players` ; `.gitignore` ne couvrait que `.env` | tous corrigés |

**Risques assumés (décision produit, 2026-07-22) :**

- **Mode spectateur ouvert à tous** — n'importe quel socket peut s'abonner à une partie en cours et voir les plateaux réels (2ᵉ onglet sur `/<room>/<pseudo>`). Le spectre reste donc contournable volontairement. Assumé comme bonus hors sujet ; à savoir expliquer en soutenance.
- **`src/test/` (détection de mains @mediapipe) conservé dans le dépôt** mais retiré du routeur et du bundle : piste de jeu « à la main » non implémentée, à reprendre plus tard.

Le socle est bon : architecture client/serveur correcte, classes `Game`/`Piece`/`Player`/`Room`, file de pièces partagée, rooms simultanées, gestion hôte/spectateurs, contrôles clavier complets, zéro `this` côté client, zéro `<table>`, aucun secret dans le dépôt.

---

## Tableau de conformité

### Contraintes techniques (chapitre IV)

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 1 | Stack 100 % JS/TS | ✅ | TypeScript partout |
| 2 | Client = framework moderne | ✅ | React 19 + hooks, 0 composant classe |
| 3 | Pas de lib de manipulation du DOM | ✅ | aucune dépendance type jQuery |
| 4 | **Pas de Canvas** | ✅ | corrigé : crops pré-calculés dans `frontend/src/config/avatarCrops.json` |
| 5 | **Pas de SVG** | ✅ | corrigé : PNG pré-rendus + CSS (`frontend/public/img/decor/`) |
| 6 | Pas de `<table>`, layout Grid/Flexbox | ✅ | `GameBoard.tsx:22-27` (CSS Grid), 0 balise table |
| 7 | Pas de `this` côté client | ✅ | 4 occurrences, **toutes en commentaire** |
| 8 | Logique plateau/pièces en fonctions pures (client) | ✅ | `config/gameConfig.ts`, `socket/gameState.ts` — 0 classe |
| 9 | Serveur orienté objet (classes `Player`, `Piece`, `Game`) | ✅ | `server/src/core/{Game,Piece,Player,room}.ts` |
| 10 | **Tests ≥ 70 % statements/functions/lines, ≥ 50 % branches** | ✅ | **1104 tests** · serveur 476 → 98.01/96.16/100/97.89 · frontend 628 → 92.26/89.71/91.06/93.66 (`src/**` entier, **plus aucune exclusion de dossier**) |
| 11 | Pas de secrets dans le dépôt | ✅ | `.env` gitignoré et jamais commité, compose 100 % `${VAR}` |

### Le jeu (chapitre V.1)

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 12 | Terrain 10 colonnes × 20 lignes | ✅ | `server/src/types/game/gameTypes.ts:5-6` |
| 13 | Même séquence de pièces pour tous, mêmes coordonnées | ✅ | `Game.ts:204-247` (sacs de 7, file unique, index par joueur) |
| 14 | **n lignes complétées → n-1 lignes de pénalité indestructibles chez les adversaires** | ❌ | `Game.ts:159-175` : aucun envoi ; `"penalty"` déclaré dans `gameTypes.ts:14` mais **jamais écrit** |
| 15 | **Spectre = hauteur du bloc le plus haut par colonne** | ✅ | corrigé : `getSpectrumBoard()` dans `gameEmitters.ts` — spectre pour les joueurs, plateaux réels pour les spectateurs |
| 16 | Nom des adversaires affiché | ✅ | `MiniBoard.tsx:41-46` |
| 17 | Mise à jour temps réel des adversaires | ✅ | ré-émis à chaque tick |
| 18 | Formes + rotations originales des tetriminos | ✅ | 7 formes correctes (`piecesGameTypes.ts:3-47`), rotation par transposition **+ wall kicks horizontaux** (`Game.ts` `ROTATION_KICKS` ±1/±2/±3, `rotate()`) : une pièce collée à un mur se décale pour tourner, jamais vers le haut. Vérifié en live (tous types, I compris) |
| 19 | Pas de système de points, dernier survivant gagne | ⚠️ | victoire correcte (`Game.ts:248-266`) **mais** score présent, trié et diffusé (`Game.ts:173`, `gameEmitters.ts:209-224`) |
| 20 | Modes solo et multijoueur | ✅ | `Game.ts:127-129`, `Game.ts:250-252` |
| 21 | Chute à vitesse constante | ⚠️ | constante en multi (400 ms) ; accélère par niveau en solo (`Game.ts:139-145`) — assumable en tant que bonus « gravité accrue » |
| 22 | Lock delay : la pièce ne se fige qu'à la frame suivante | ✅ | **déjà conforme** — le tick qui amène au contact ne fait que descendre la pièce, le verrouillage n'a lieu qu'au tick suivant (`Game.lockdelay.test.ts`) |
| 23 | Contrôles ← → ↑ ↓ + espace | ✅ | `components/game/GameView.tsx:57-82` |

### Gestion de partie (chapitre V.2.1)

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 24 | URL `http://<host>:<port>/<room>/<player_name>` | ⚠️ | route correcte (`router.tsx:32`, `createBrowserRouter`) mais l'arrivée directe est redirigée vers l'accueil tant que le pseudo n'a pas de faction (`useAuthGuard.ts:69-74`) |
| 25 | BrowserRouter ou MemoryRouter | ✅ | `router.tsx:21` |
| 26 | Premier joueur = hôte, seul à lancer | ✅ | `room.ts:25-26`, `roomHandlers.ts:159` |
| 27 | Hôte réattribué s'il quitte | ✅ | `room.ts:81-99` |
| 28 | Restart par l'hôte | ⚠️ | possible indirectement (la room repasse `waiting` en fin de partie, `Game.ts:262`) mais **aucun bouton « Rejouer »** dans `GameOverView.tsx` |
| 29 | Pas de nouveau joueur en cours de partie | ✅ | `room.ts:30-32` → `joined:false` → bascule spectateur |
| 30 | Fin quand il ne reste qu'un joueur | ✅ | `Game.ts:248-252` |
| 31 | Parties simultanées | ✅ | `roomSocketStore.ts:5` (une `Room` + un `Game` + un interval par partie) |

### Serveur et client (V.2.2 / V.2.3)

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 32 | Boucle asynchrone socket.io + protocole défini | ✅ | `socketInit.ts:13-26`, protocole documenté dans `BACKEND_game.md` + `server/ws-docs.json` (27 events) + page `/docs-ws` |
| 33 | **Le serveur sert `index.html`, `bundle.js` et les assets via HTTP** | ✅ | corrigé : `express.static` + fallback SPA dans `server/src/app.ts`, service `backend-prod` dans le compose |
| 34 | Client SPA | ✅ | un seul `index.html`, rendu 100 % client |

---

## P0 — Bloquants (échec direct du projet)

### [x] 1. Tests unitaires — CORRIGÉ le 2026-07-22

> Sujet : « Unit tests must cover at least 70 % of statements, functions, and lines, and 50 % of branches. »

**Résultat : 644 tests verts, les 4 seuils dépassés des deux côtés.**

| | Statements | Branches | Functions | Lines | Tests |
|---|---|---|---|---|---|
| Seuil sujet | 70 % | 50 % | 70 % | 70 % | — |
| **Serveur** | 98.22 % | 96.64 % | 100 % | 98.11 % | 454 (30 fichiers) |
| **Frontend** | 99.69 % | 98.00 % | 100 % | 100 % | 209 (18 fichiers) |

Commandes : `make test` (les deux), `make test-server`, `make test-front`, ou `npm run test:coverage` dans chaque dossier.
Prisma, les émetteurs réseau et `settleGameRewards` sont mockés ; `getRenderedBoard` reste réel pour que `lockPiece`/`clearLines` testent le vrai comportement. `vi.useFakeTimers()` partout où la boucle de jeu tourne : aucun interval qui fuit, aucune base, aucun socket. Suite rejouée 4 fois de suite sans variation.

Détail de la mise en place :

- [x] `vitest` + `@vitest/coverage-v8` installés des deux côtés (+ `jsdom`, `@testing-library/react` côté frontend)
- [x] Scripts `test` / `test:coverage` / `test:watch` dans les deux `package.json`, cibles `make test`, `make test-server`, `make test-front`
- [x] Seuils configurés dans les deux `vitest.config.ts` (70/70/70 et 50 branches) : la commande **échoue** automatiquement si la couverture retombe sous les seuils
- [x] **Frontend : 207 tests** (18 fichiers) · **Serveur : 437 tests** (28 fichiers) · aucun fichier de production modifié, `npm run build` toujours vert des deux côtés, aucun `*.test.js` dans `server/dist`
- [x] Couverture serveur : `src/**` hors client Prisma généré, `server.ts` et `types/` — donc le vrai code métier, y compris handlers, emitters, services et validateurs

> ⚠️ `jsdom` est volontairement maintenu en **26.x** : la 27 tire une dépendance qui exige `require(esm)`, indisponible avant Node 22.12, et faisait échouer `npm test` sur cette machine (Node 22.9). Ne pas passer à `jsdom@27` sans imposer Node ≥ 22.12 partout.

> Périmètre de couverture frontend (déclaré dans `frontend/vitest.config.ts`) : `components/game`, `socket`, `config`, `types`. Les pages vitrine (accueil, dashboard, boutique, doc WS) et le bonus webcam en sont exclus — à assumer en soutenance.
- [ ] Tests serveur — priorité au cœur métier (~550 lignes) :
  - [ ] `Game.ts` : `canMove`, `canRotate`, `canSpawn`, `clearLines`, file de pièces (déterminisme + identité entre joueurs), `lockAndSpawnNext`, `checkGameOver` solo/multi
  - [ ] `Piece.ts` : rotation, déplacements, bornes
  - [ ] `room.ts` : hôte au premier arrivant, réattribution, `canJoin` selon statut, kick
  - [ ] handlers socket via `SocketMock.ts` (déjà présent dans le repo)
- [ ] Tests frontend — cibler le code pur :
  - [ ] `socket/gameState.ts` (normalizers), `config/gameConfig.ts` (`trimShape`, `getCellTheme`, `isFilledCell`)
  - [ ] rendu `GameBoard` / `MiniBoard` / `NextPiecePreview` (React Testing Library)
- [ ] Vérifier les 4 métriques et les faire figurer dans le README

### [x] 2. Canvas utilisé côté client (interdit) — CORRIGÉ le 2026-07-22

`computeAvatarCrop()` créait un `<canvas>` pour détecter la boîte englobante alpha des avatars.

- [x] Calcul déplacé hors ligne : `frontend/scripts/generate-avatar-crops.mjs` (décodeur PNG maison, zlib natif, zéro dépendance) → `frontend/src/config/avatarCrops.json`, lu directement par le composant
- [x] Script npm : `npm run generate:avatar-crops` (à relancer si des avatars sont ajoutés)
- [x] **Vérifié** : les 20 crops générés sont identiques au pixel près à ceux que produisait le canvas (contre-calcul indépendant avec Pillow, écart maximum = 0.0)
- [x] `grep -rn "canvas\|getContext" frontend/src` → vide hors `src/test/`

### [x] 3. SVG inline (interdit) — 4 blocs — CORRIGÉ le 2026-07-22

- [x] Les 2 éclairs sont pré-rasterisés en PNG transparents : `frontend/scripts/generate-decor-assets.py` → `frontend/public/img/decor/`. L'éclair du hero est un `<img>` étiré (le PNG embarque la marge des extrémités arrondies) ; celui de la carte personnage passe par deux `mask-image`, car sa couleur dépend de la faction.
- [x] La poignée de bord est reproduite en CSS : dégradé identique au `<linearGradient>` + `border-radius` elliptique.
- [x] Le chevron est reproduit en CSS : deux carrés concentriques tournés à 45°, bordures arrondies pour imiter `linejoin`/`linecap` round.
- [x] **Vérifié visuellement** dans Chrome, avant/après côte à côte : éclairs et poignée indiscernables, chevron très proche (les extrémités arrondies ont été ajustées après une première version trop massive).
- [x] `grep -rn "<svg\|<path" frontend/src` → vide

> ⚠️ Les PNG sont commités. Le script Python n'est à relancer que si le tracé ou les couleurs changent (dépendance : Pillow).

### [x] 4. MediaPipe / page `/test` accessibles en production — CORRIGÉ le 2026-07-22

Deux causes distinctes, la seconde bien plus grave que la première :

1. `router.tsx` déclarait `{ path: "test" }` **sans garde**. Corrigé : le `lazy()` est désormais **dans** la branche `import.meta.env.DEV`, comme `docs-ws`.
2. **Le build « de production » était en réalité un build de développement.** `vite.config.ts` lit le `.env` de la racine via `loadEnv`, lequel contient `NODE_ENV=development` (nécessaire au service `backend-dev`). Vite recopiait cette valeur dans `VITE_USER_NODE_ENV` et basculait tout le build en mode dev : `import.meta.env.DEV === true`, React en `jsxDEV`, la branche DEV survivait — donc `TestPage-*.js` (141 Ko, `createElement("canvas")`, `getContext`, `webgl2`) atterrissait dans `dist/`. Le correctif du routeur était **neutralisé**. Corrigé par `delete process.env.VITE_USER_NODE_ENV` dans `vite.config.ts`.

Vérifié sur un build réel : `dist/` ne contient plus **aucune** occurrence de `canvas`, `getContext`, `webgl2`, `HandLandmarker`, `mediapipe` ni `jsxDEV` (410 Ko au lieu de 676 Ko, 138 modules au lieu de 153).

Verrouillé par `frontend/src/build.production.test.ts`, qui lance un vrai `vite build` et grep le résultat — c'est le seul niveau où l'invariant est vérifiable. Rétablir le bug fait bien échouer ce test.

Le code de `src/test/` (détection de mains) est **conservé dans le dépôt** et reste accessible en dev : c'est une piste de gameplay à reprendre.

---

## P1 — Mécaniques obligatoires absentes

### [ ] 5. Lignes de pénalité (n-1, indestructibles)

C'est **le** manque fonctionnel principal : le multijoueur n'a aujourd'hui aucune interaction entre joueurs.

- [ ] Dans `Game.clearLines()` (`Game.ts:159-175`), remonter le nombre de lignes effacées
- [ ] Ajouter `addPenaltyLines(playerState, n-1)` : pousser `n-1` lignes `"penalty"` en bas du board de **chaque adversaire vivant**, décaler leur pile vers le haut, tuer le joueur si sa pile déborde
- [ ] Rendre ces lignes indestructibles : les exclure du filtre de `clearLines` (aujourd'hui le filtre est `row.every(cell => cell !== 0)`)
- [ ] Gérer la collision de la pièce courante avec les lignes montantes
- [ ] Le rendu client existe déjà (`gameState.ts:22-23` accepte `"penalty"`) — vérifier la couleur grise

### [x] 6. Spectre des adversaires — CORRIGÉ le 2026-07-22

Règle retenue : **un joueur en partie ne voit que le spectre de ses adversaires ; un spectateur voit les vrais plateaux.**

- [x] `getSpectrumBoard()` (`server/src/gateways/socket/emitters/gameEmitters.ts`) : chaque colonne est remplie depuis son bloc le plus haut jusqu'en bas avec le marqueur `"spectrum"` — ni couleurs de pièces, ni trous visibles sous la pile
- [x] `game:start` / `game:update` (destinés aux **joueurs**) → spectre ; `game:SpectatorGame` (destiné aux **spectateurs**) → plateaux réels, couleurs et trous compris
- [x] Nouveau type de cellule `"spectrum"` côté serveur (`gameTypes.ts`) et côté client (`types/game.ts`, `gameState.ts`), rendu en monochrome via `CELL_THEME.spectrum`
- [x] 11 tests dédiés côté serveur (`gameEmitters.spectrum.test.ts`) + 2 côté client
- [x] `BACKEND_game.md` et `server/ws-docs.json` mis à jour (la page `/docs-ws` reste synchro)
- [ ] Reste à faire : le voir tourner à deux joueurs en vrai (validé par tests seulement)

### [x] 7. Lock delay — DÉJÀ CONFORME, l'audit initial était faux

> Sujet : « Once a piece touches the pile, it becomes immobile only on the next frame — allowing last-moment adjustments. »

Le premier audit concluait à tort qu'il manquait, en lisant le `else lockAndSpawnNext()` de `tick()` sans dérouler la séquence temporelle. En réalité : le tick qui amène la pièce au contact se contente de **la faire descendre** ; c'est seulement le tick **suivant** qui la verrouille. Le joueur dispose donc bien d'une frame entière (400 ms en multi) pour ajuster.

- [x] Comportement verrouillé par 4 tests (`server/src/core/Game.lockdelay.test.ts`) : pas de verrouillage au contact, déplacement latéral encore possible, verrouillage au tick suivant, et report du verrouillage si l'ajustement rouvre une descente
- [ ] Nuance à connaître pour la soutenance : le délai **ne se réinitialise pas** à chaque mouvement (contrairement aux Tetris modernes). Le sujet ne l'exige pas.

### [x] 8. Le serveur doit servir la SPA — CORRIGÉ le 2026-07-22

> Sujet : « It must also serve index.html, bundle.js, and any static assets via HTTP. »

- [x] `express.static` + fallback SPA dans `server/src/app.ts` (résolution via `STATIC_DIR`, sinon `frontend/dist`)
- [x] Profil `prod` du compose réparé : nouveau service `backend-prod` qui monte le volume `frontend_dist` et attend la fin de `frontend-builder`
- [x] Stage `prod` ajouté au `server/Dockerfile` (`prisma generate` + `tsc` + `node dist/server.js`), image construite avec succès
- [x] `VITE_PORT` passé en build-arg au `frontend-builder` : sans lui le bundle de prod pointait le socket vers `http://host:undefined`
- [x] **Vérifié par exécution** : `GET /` → 200 HTML, `GET /maroom/bob` → `index.html` (l'URL du sujet fonctionne), `GET /assets/*.js` → 200 — testé en `tsx` et sur le build compilé
- [x] **`make prod` validé de bout en bout** : `frontend-builder` construit et copie le `dist/` dans le volume, `backend-prod` le sert (`/` → 200, `/maroom/bob` → `index.html`, bundle de 410 Ko servi, port du socket correctement figé à 3001 dans le bundle)

> ⚠️ dev et prod écoutent le **même** `${PORT}` : impossible de lancer les deux stacks en même temps (`Bind for 0.0.0.0:3001 failed: port is already allocated`). Faire `make dev-down` avant `make prod`.

---

## P2 — Écarts à arbitrer

- [ ] **Système de points** — le sujet dit « there is no scoring system ». Le score existe, est trié dans `game:over` et converti en berrys. À assumer explicitement comme bonus (« Add a scoring system » est dans le chapitre VI) : s'assurer que **le vainqueur est le dernier survivant, jamais le meilleur score**.
- [x] **Rotation contre un mur** — ~~rotation impossible contre un mur~~ **corrigé le 2026-07-23** : wall kicks horizontaux dans `Game.rotate()` (table `ROTATION_KICKS`, `Piece.translate`). Une pièce collée à un bord se décale de 1 à 3 cases pour tourner (le I large de 4 va jusqu'à ±3), jamais de décalage vertical. 6 tests (`Game.test.ts` rotate, `Piece.test.ts` translate) + validation live tous types. Reste sans pivot central « vrai » (rotation par transposition ancrée haut-gauche) et `Piece.rotation`/`getRotate()` toujours code mort — cosmétique, non bloquant.
- [ ] **Join direct par URL** — `useAuthGuard.ts:69-74` redirige vers l'accueil. Un correcteur qui colle `http://host:port/room1/bob` doit tomber dans la partie. Prévoir au minimum un chemin rapide (faction par défaut) ou une démo maîtrisée en soutenance.
- [ ] **Dépendance dure à PostgreSQL** — `playerService.createPlayer()` fait un `findUnique` Prisma et renvoie `null` si l'utilisateur n'existe pas, donc `room:join` échoue : **le jeu ne démarre pas sans base**, alors que le sujet dit qu'aucune persistance n'est nécessaire. Prévoir un mode dégradé (joueur en mémoire) ou garantir que `make dev` monte la base de façon fiable.
- [ ] **Bouton « Rejouer »** dans `GameOverView.tsx` pour l'hôte (le restart n'est aujourd'hui possible qu'en repassant par le lobby).
- [ ] **Vitesse solo croissante** — à présenter comme le bonus « increased gravity », pas comme le mode par défaut.

---

## P3 — Bugs relevés pendant l'audit

- [x] **B1** ~~`roomHandlers.ts:158-163` : `new Game(...)` construit avant le contrôle d'hôte~~ — **corrigé le 2026-07-22**. Les contrôles (hôte **et** `status === "waiting"`) passent désormais avant la construction. Deux tests de régression ajoutés : un non-hôte ne modifie plus l'état des joueurs, un second `room:start` ne crée plus ni Game ni `setInterval` supplémentaire.
- [x] **B2** ~~à la déconnexion, le joueur est retiré de `Room.players` mais jamais de `Game.state`~~ — **corrigé le 2026-07-22** : `Game.abandon(socketId)` (mort + `checkGameOver()`) est appelé depuis `room:leave` **et** depuis `disconnect`, et `checkGameOver` purge les abonnements spectateur de la partie. Vérifié : l'interval de gravité s'arrête réellement (test avec faux timers), un seul `game:over`, un seul crédit de berrys.
- [ ] **B3** `gameEmitters.ts:135-138` : `throw new Error(...)` levé depuis le callback de `setInterval` → exception non capturée → **crash du process**, donc toutes les parties simultanées tombent. Ajouter un `try/catch` dans `tick()` et un `process.on("uncaughtException")`.
- [ ] **B4** `tick()` (`Game.ts:304-305`) : `break` sur game over → les joueurs suivants dans la `Map` ne reçoivent pas leur dernière frame. Indentation cassée du bloc `Game.ts:294-311`.
- [ ] **B5** `roomEmitters.ts:28` annonce `maxPlayers: 4` alors que `Room.addPlayer` (`room.ts:22-29`) n'a **aucune limite**.
- [x] **B6** ~~Erreur de compilation TypeScript côté serveur : `SocketMock.ts(112,52) TS2345`~~ — **corrigé le 2026-07-22** (garde `!doc.response` ajoutée ligne 109). Elle bloquait `npm run build`, donc toute image de production.
- [ ] **B7** `middlesware/cors.ts:11` : origine `https://red-tetris.com` **en dur** hors dev, incohérente avec `frontendOrigins` (env) utilisée par socket.io → CORS cassé en prod.
- [ ] **B8** `Player.setInGame(false)` n'est jamais appelé ; `Player.getGame()` n'est lu nulle part (code mort).

### Remontés par l'écriture des tests (2026-07-22)

- [ ] **B9** `frontend/src/socket/socket.ts:6-7` : `import.meta.env.VITE_PORT` **sans valeur de repli**. La variable n'existe qu'au build Docker ; en `npm run dev` hors Docker l'URL devient `http://<host>:undefined` et **le socket ne se connecte jamais**. `DocsWsPage.tsx:26` fait le même calcul mais avec `|| "3000"` — incohérence à unifier.
- [ ] **B10** Contrat `game:over` désaligné : le serveur envoie `level` à la racine (`gameEmitters.ts:210-222`), le front ne le lit que dans chaque score (`gameState.ts:110`) et jette la valeur. Rattrapé par un contournement dans `GamePage.tsx:443`, donc invisible aujourd'hui, mais fragile.
- [ ] **B11** `GameOverView.tsx:39` : `rank: index + 1` suppose des scores déjà triés. Vrai aujourd'hui (`gameEmitters.ts:215`), mais rien ne le garantit côté front.
- [ ] **B12** `GameView.tsx:58` : la garde anti-répétition clavier ne couvre que `Space` ; la rotation (`ArrowUp`/`KeyX`) part en auto-repeat si la touche est maintenue.
- [ ] **B13** `GameView.tsx:88` (`if (!isSpectator) return`) et `socket/events/user.ts:6-7` (`registerUserListeners` vide) : code mort.
- [ ] **B14 — validation** `gateways/socket/validators/validateSocketEvent.ts:29-36` : `validateCheckUsername` vérifie que la clé `username` existe mais **jamais son type**, contrairement à tous les validateurs de `validateRoomEvent.ts`. `{username: 12345}` passe, `isValidUsername(12345)` renvoie `true` (coercition par `RegExp.test`, `utils/unsernameValidator.ts:4`), et une valeur non-string atteint la requête Prisma et le `userSocketStore`.
- [ ] **B15** `gateways/socket/roomSocketStore.ts:1-3` : imports inutilisés dont `createRoom`, qui crée un cycle d'imports `roomSocketStore → roomService → roomSocketStore`.
- [ ] **B16** `core/room.ts:130` : `startGame()` est un stub vide (code mort).

---

### Follow-ups issus de la boucle d'audit (Mineur / Nit, non bloquants)

- [ ] **Chevron, jonction bras/disque** : à fort grossissement (×8 et plus) la jonction montre un écart sub-pixel dû à l'arrondi des `border-width` fractionnaires par le navigateur (6,017 px et 11,083 px). Invisible à la taille réelle de 38 px ; la géométrie elle-même est exacte à moins de 0,01 px (vérifiée par calcul indépendant et par `chevronGeometry.test.ts`).
- [ ] **`CELL_THEME` / `getCellTheme` / `isFilledCell`** (`frontend/src/config/gameConfig.ts`) sont du **code mort** : le rendu passe entièrement par `data-piece` + CSS. 6 tests portent dessus et gonflent la couverture sans rien prouver du rendu. À supprimer, ou à rebrancher dans `Cell.tsx`.
- [ ] **Couverture frontend annoncée** : 90,6 % avec `src/test/**` exclu ; **70,5 %** si on le réintègre. Le projet passe les seuils dans les deux cas, mais c'est ~70 % qu'il faut annoncer en soutenance si l'exclusion est contestée.
- [ ] `frontend/vitest.config.ts` exclut `src/vite-env.d.ts`, **qui n'existe pas** (exclusion fantôme).
- [ ] Deux tests « exécute les handlers sans lever d'erreur » (`socket/events/game.test.ts`, `room.test.ts`) portent sur des stubs `console.log` : remplissage de couverture, à supprimer avec le code mort correspondant.
- [ ] Un chunk `DocsWsPage-*.js` (29 Ko) reste émis en production alors que la route est absente. Aucun API interdit dedans, mais c'est du poids inutile.
- [ ] `frontend/public/prompt` (prompt de génération d'avatars par IA) est copié dans `dist/` et **servi publiquement** ; `frontend/src/test/prompt.md` est un prompt d'instructions livré dans `src/`. Aucun impact technique, mauvais effet en soutenance.
- [ ] Un **spectateur externe n'est jamais notifié de la fin de partie** : `emitGameOver` n'itère que `game.state`, son écran reste figé sur la dernière frame.
- [ ] `server/tsconfig.json` exclut `src/**/*.test.ts` du typecheck et vitest ne typechecke pas : **plus rien ne vérifie les types des tests serveur**. Prévoir un `tsconfig.build.json` séparé.
- [ ] `Player.setInGame(false)` n'est jamais appelé, `getInGame()`/`getGame()` ne sont lus nulle part : après une partie tous les `Player` restent `inGame === true`.
- [ ] `handleRoomStart` refuse silencieusement (non-hôte, statut ≠ `waiting`) sans `emitError`, contrairement à tous les autres garde-fous.
- [ ] `middlesware/cors.ts` code en dur `https://red-tetris.com` hors dev et ignore `FRONTEND_ORIGIN`, pourtant injecté dans `backend-prod` (variable morte, deux politiques CORS incohérentes).
- [ ] Image serveur de prod non élaguée : `npm install` complet (devDependencies + vitest), sources TS et fichiers de test embarqués, exécution en root. Passer à un stage runtime avec `npm ci --omit=dev` et `USER node`.
- [ ] Dépendance morte `liquid-glass-react` (jamais importée, injecte des filtres SVG) : à retirer de `frontend/package.json`.
- [ ] Un rafraîchissement de page pendant une partie à deux compte désormais comme un abandon (fin de partie immédiate, victoire à l'adversaire). Comportement volontaire du correctif B2, à arbitrer côté produit.

---

## P4 — Nettoyage et hygiène

- [ ] **README.md périmé et faux** : il annonce Redux Toolkit, shadcn/ui, Motion, Playwright, React Testing Library et une arborescence `features/` — **rien de tout cela n'existe**. Il contient aussi des artefacts de génération (`:contentReference[oaicite:N]{index=N}`) et référence `frontend/nginx.conf`, absent. À réécrire (installation, lancement, protocole, commandes de test, couverture).
- [ ] Dépendance morte `liquid-glass-react` (`frontend/package.json:13`) — jamais importée, et ce type de lib injecte des filtres SVG. À retirer.
- [ ] `console.log` de debug : `Game.ts:233` (`"test"`), `roomService.ts:21`
- [ ] Imports morts : `userInfo` (`os`) dans `roomService.ts:7`, `error` (`node:console`) dans `userRepositories.ts:6`
- [ ] Dossier `server/src/middlesware/` — faute de frappe, à renommer `middlewares/`
- [ ] Listeners morts `registerGameListeners` (`frontend/src/socket/events/game.ts:6-18`, `// TODO`) qui doublonnent ceux de `GamePage.tsx:463-467`
- [ ] `GameView.tsx:148` : `<span hidden>{playerName}</span>` pour contourner un warning TS — le nom du joueur n'est affiché nulle part sur l'écran de jeu
- [ ] `Game.ts:205` : `const pieces` masque l'import `pieces` de `piecesGameTypes.ts`
- [ ] Logique Tetris dupliquée dans `test/TestPage.tsx:16-136` (shapes/couleurs propres, sans lien avec le jeu réel)
- [ ] **`frontend/dist/assets` appartient à `root`** (créé par un conteneur Docker) → `npm run build` échoue en local avec `EACCES: permission denied, unlink`. À supprimer avec les droits adéquats, et à éviter en fixant l'utilisateur dans le service de build.
- [ ] **`main` a 124 commits de retard sur `theo`** — merger avant la soutenance, le rendu se fait sur la branche par défaut
- [ ] Pas de CI (`.github/` absent) — le sujet parle de pipelines de livraison continue : une action GitHub qui lance `npm test` serait un plus

---

## Bonus déjà en place

Rappel du sujet : *« Bonus features will only be considered if the mandatory requirements are COMPLETED AND FUNCTIONAL. »* — donc tout ce qui suit ne compte que si les sections P0 et P1 sont soldées.

- Système de score et de niveaux
- Persistance : comptes, factions, avatars, berrys, thèmes (PostgreSQL + Prisma)
- Boutique de thèmes de pièces
- Mode spectateur (avec choix du joueur observé)
- Contrôle du jeu à la webcam (MediaPipe, détection de gestes)
- Page de documentation des events WebSocket (`/docs-ws`)
- Thème visuel arcade néon, animations parallax
- Docker Compose + Makefile

---

## Ordre de bataille conseillé

1. ~~Purger les interdits~~ — **fait** (sauf P0-4, la route `/test` toujours exposée en prod : une ligne à changer dans `router.tsx`).
2. ~~Service des statiques + profil prod~~ — **fait**.
3. ~~Tests~~ — **fait** (644 tests). À maintenir : chaque correction ci-dessous doit venir avec ses tests, la commande échoue si la couverture retombe sous les seuils.
4. ~~Spectre~~ — **fait**. ~~Lock delay~~ — **était déjà conforme**.
5. **Lignes de pénalité** (P1-5) — dernière mécanique obligatoire manquante ; sans elles, le multijoueur n'a pas d'interaction. *(en cours côté équipe)*
6. **Bugs B2/B3** — déconnexion en cours de partie et `throw` dans le `setInterval` : les deux plantages les plus visibles en soutenance. ~~B1~~ corrigé. B14 (validation d'entrée) est le seul à teinte sécurité.
7. README, nettoyage, merge sur `main`.

---

## Checklist de soutenance

- [ ] `make dev` (ou `make prod`) lance tout le jeu, base incluse, sans étape manuelle
- [ ] Deux navigateurs, deux joueurs, même room : mêmes pièces dans le même ordre
- [ ] Un joueur fait 2+ lignes → l'adversaire reçoit les lignes de pénalité et ne peut pas les effacer
- [ ] Les spectres adverses bougent en temps réel avec le nom de chaque joueur
- [ ] Le dernier survivant est déclaré vainqueur
- [ ] Partie solo jouable
- [ ] Deux parties simultanées dans deux rooms différentes, sans interférence
- [ ] L'hôte quitte → un autre joueur devient hôte
- [ ] Un arrivant en cours de partie devient spectateur
- [x] `make test` affiche les 4 métriques ≥ 70/70/70/50 *(vérifié : 644 tests, tout au-dessus)*
- [x] `grep -rn "<svg\|canvas\|getContext" frontend/src` → vide hors `src/test/` *(vérifié)*
- [x] `git grep -iE "password|secret|api_key"` sur les fichiers trackés → rien de sensible *(vérifié)*
- [ ] `make dev-down` avant `make prod` (les deux stacks se disputent le même port)
