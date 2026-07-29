# Fiche correction — Gab

> Antisèche perso pour la soutenance. Ce que **tu** as construit, où ça vit, et les
> questions qui vont tomber dessus.
> Vue d'ensemble : [README](../README.md) · mécaniques : [GAMEPLAY](GAMEPLAY.md)

---

## 1. Ton rôle en une phrase

Tu as posé **toute la fondation serveur** : Express + Socket.IO + PostgreSQL/Prisma, la
couche gateway (handlers / emitters / validators / stores), les classes métier
(`Player`, `Piece`, `Game`, `Room`) et le premier moteur de jeu jouable — mouvements,
score, game over, montée de niveau, pénalités, spectateurs.

Répartition indicative en lignes encore présentes dans le code :

| Zone | toi | Théo |
|---|---|---|
| `server/src/gateways/` | **738** | 706 |
| `server/src/core/` | 469 | 819 |
| `server/src/services/` | 69 | 146 |
| `server/prisma/` | 63 | 444 |

`core/` et `gateways/` ont été retravaillés à quatre mains ensuite — c'est normal que le
compte ait bougé, la structure est la tienne.

---

## 2. Ce que tu as écrit

### Infrastructure serveur

- **Express 5 + Socket.IO 4** — `server/src/app.ts`, `server/src/server.ts`,
  `gateways/socket/socketInit.ts`. C'est toi qui as branché Socket.IO sur le serveur
  HTTP et écrit la config CORS (`config/socketConfig.ts`, `middlewares/cors.ts`).
- **PostgreSQL + Prisma** — `server/prisma/schema.prisma`, les 4 migrations,
  `config/prisma.ts`. Tu as choisi Prisma et écrit le modèle `User` (pseudo, faction,
  avatar) sur lequel tout le reste s'est greffé.
- **Docker Compose** — service `db` + Adminer, puis pgAdmin.

### Couche gateway (la plus grosse part)

L'architecture en 4 couches, c'est toi :

```
handlers/     reçoivent l'événement client, orchestrent
emitters/     construisent et envoient les réponses
validators/   valident le payload AVANT d'entrer dans le métier
*Store.ts     annuaires en mémoire (socket ↔ user, socket ↔ room, spectateurs)
```

Fichiers clés : `handlers/roomHandlers.ts` (253 lignes à toi — le plus gros du serveur),
`handlers/userSocket.ts`, `emitters/roomEmitters.ts`, `emitters/gameEmitters.ts`,
`validators/validateSocketEvent.ts`, `userSocketStore.ts`, `roomSocketStore.ts`,
`spectatorSocketStore.ts`.

### Classes métier

- **`Player`** (`core/Player.ts`) — 38 lignes sur 47 sont à toi. Pseudo, socketId,
  avatar, faction, thème, référence vers sa `Game`.
- **`Piece`** (`core/Piece.ts`) — 59 lignes sur 65. Position, `moveLeft/Right/Down`,
  `translate`, `getRotatedShape`.
- **`Room`** (`core/room.ts`) — cycle de vie complet : `addPlayer`, `canJoin`,
  `isFull`, `removePlayer`, **`reassignHost`** (l'hôte est le premier arrivé, transmis
  s'il part), `setMode`, `setPrivate`, statuts `waiting / playing / finished`.
- **`Game`** (`core/Game.ts`) — la première version : boucle de gravité, collisions,
  verrouillage, nettoyage de lignes, score, game over, niveau et accélération en solo.

### Gameplay que tu as implémenté

- Contrôles des pièces, chute, verrouillage, nettoyage de lignes
- Score et montée de niveau (vitesse qui augmente en solo)
- Détection de game over et flux de fin de partie
- **Lignes de pénalité** aux adversaires + le fix qui exclut les lignes de pénalité du
  nettoyage (elles sont indestructibles — exigence du sujet)
- **Spectateurs** : abonnement / désabonnement et diffusion des frames
- Gestion du `kick`, événement `room:kicked`
- Enregistrement / disponibilité du pseudo, validation d'avatar et de faction

---

## 3. Technos que tu dois savoir défendre

| Techno | Ce que tu en dis |
|---|---|
| **Node.js + Express 5** | serveur HTTP ; sert aussi la SPA en prod (`express.static` + fallback) |
| **Socket.IO 4** | temps réel bidirectionnel, reconnexion et rooms natives — plus simple qu'un `ws` brut |
| **Prisma 7 + PostgreSQL 18** | ORM typé ; migrations versionnées dans `prisma/migrations/` |
| **TypeScript** | typage strict côté serveur, types partagés dans `types/` |
| **Classes ES6** | exigé par le sujet : le serveur est **orienté objet** |
| **Vitest** | tests unitaires + couverture V8 |

---

## 4. Questions probables du correcteur

**« Montre-moi que le serveur est orienté objet. »**
→ `server/src/core/` : `Player`, `Piece`, `Game`, `Room`, quatre vraies classes avec
état privé et méthodes. Le sujet en exige au minimum trois.

**« Où est distribuée la séquence de pièces ? »**
→ `Game.pieceQueue`, un sac de 7 mélangé côté serveur. Chaque joueur a son propre
`pieceIndex` dans cette file : **même séquence pour tous**, mais chacun avance à son
rythme. Un client ne tire jamais une pièce lui-même.

**« Comment un joueur devient hôte ? »**
→ `Room.addPlayer()` : le premier arrivé. `Room.reassignHost()` : s'il part, le suivant
dans la liste reprend la main. `Room.canJoin()` refuse toute arrivée si le statut n'est
plus `waiting` — on n'entre pas dans une partie lancée.

**« Comment tu valides ce qui arrive du client ? »**
→ `gateways/socket/validators/`. Rien n'entre dans le métier sans passer par là.
`isEmptyPayload()` traite le cas des événements sans argument : `undefined`, `null` et
`{}` sont acceptés, tout payload porteur de données non validées est rejeté.

**« Le client peut-il tricher ? »**
→ Non. Il n'envoie que des **intentions** (`game:move`, `game:rotate`, `game:drop`).
Plateau, collisions, rotations, gravité, pénalités et condition de victoire vivent
uniquement sur le serveur. Le client rend ce qu'il reçoit, il ne simule rien.

**« Où est stockée une partie en cours ? »**
→ **En mémoire**, dans `roomSocketStore`. Aucune requête base pendant le jeu. Postgres
ne sert qu'aux bonus (comptes, berrys, historique, stats).

**« Pourquoi les lignes de pénalité ne se nettoient pas ? »**
→ Le sujet les veut indestructibles. La boucle de nettoyage les exclut explicitement —
c'est le correctif `f3cb430`.

---

## 5. Les pièges à connaître

- **`server/src/generated/prisma/` n'est pas versionné.** Sur un clone frais il faut
  `npx prisma generate` (le `Makefile` le fait tout seul via la cible `prisma-client`).
- **Prisma 7 exige Node ≥ 22.12.** En dessous, `prisma generate` casse sur un
  `ERR_REQUIRE_ESM`. Les images Docker sont en node:24, donc seuls les tests hors Docker
  sont concernés.
- **Pas de `postinstall: prisma generate`.** Dans les Dockerfiles, `npm install` tourne
  **avant** que `prisma/schema.prisma` ne soit copié : le build échoue. La génération se
  fait après le `COPY`.
