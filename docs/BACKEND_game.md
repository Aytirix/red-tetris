# Backend — Contrat attendu par le frontend

Ce document résume ce que le frontend attend du backend pour la partie Tetris, afin de te permettre d'implémenter les handlers Socket.IO côté `server/` sans avoir besoin de lire le code du frontend.

La doc complète des events est dans `server/ws-docs.json` (consultable aussi via la page `/docs-ws` une fois le projet lancé). Ce README est un résumé pratique.

---

## 1. Vue d'ensemble du flow

```
┌─────────────┐  user:CheckUsernameAvailable / Register  ┌─────────────┐
│  HomePage   │  ────────────────────────────────────►   │   server    │
└─────────────┘  ◄────  user:ResultUsernameAvailable     └─────────────┘

┌─────────────┐                  room:join                ┌─────────────┐
│  GamePage   │  ────────────────────────────────────►   │   server    │
└─────────────┘  ◄────  room:joined { joined: true|false} └─────────────┘
       │                                                          │
       │  joined=true  ──►  Lobby                                 │
       │  joined=false ──►  game:subscribeSpectatorGame {user:null}
       │
       │  Lobby admin clique ▶ Lancer  ──►  room:start
       │                       ◄──  game:start (à tous)
       │
       │  Player → game:move / game:rotate / game:drop
       │           ◄──  game:update (au joueur)
       │
       │  Spectator ◄──  game:SpectatorGame  (à chaque update du joueur observé)
       │
       │  Fin       ◄──  game:over { winner, scores }
```

---

## 2. Events front → back (à implémenter)

| Event                              | Payload                                                                 | Notes |
|-----------------------------------|--------------------------------------------------------------------------|-------|
| `user:CheckUsernameAvailable`     | `{ username: string }`                                                  | Réserve le pseudo en session si dispo. |
| `user:Register`                   | `{ faction: "pirate"\|"marine", avatar: string }`                       | Pseudo lu depuis la session socket. |
| `room:join`                       | `{ roomId: string }` (max 15 chars)                                     | Crée la room si absente. |
| `room:leave`                      | `{}`                                                                    | Réassigner host si admin part. |
| `room:kick`                       | `{ username: string }`                                                  | Réservé admin. |
| `room:setMode`                    | `{ mode: string }`                                                      | Réservé admin. |
| `room:setPrivate`                 | `{ private: boolean }`                                                  | Réservé admin. |
| `room:start`                      | `{}`                                                                    | Réservé admin. Émet `game:start` à tous. |
| `room:subscribeList`              | `{}`                                                                    | Stream `room:list`. |
| `room:unsubscribeList`            | `{}`                                                                    |       |
| `game:move`                       | `{ direction: "left"\|"right"\|"down" }`                                | Joueur courant uniquement. |
| `game:rotate`                     | `{}`                                                                    |       |
| `game:drop`                       | `{}` — hard drop                                                        |       |
| `game:subscribeSpectatorGame`     | `{ roomId: string, user: null \| string }`                              | `user: null` ⇒ premier joueur dispo. |
| `game:unsubscribeSpectatorGame`   | `{}`                                                                    | Arrêter d'émettre `game:SpectatorGame`. |

---

## 3. Events back → front (à émettre)

### `room:joined` (au joueur qui rejoint uniquement)

```json
{
  "roomId": "ma-room",
  "joined": true,
  "players": [
    { "username": "luffy", "avatar": "luffy", "faction": "pirate" }
  ]
}
```

- `joined: true` → la room est en lobby, le joueur est ajouté.
- `joined: false` → la game est déjà lancée. Le front bascule automatiquement en spectateur (envoie `game:subscribeSpectatorGame {roomId, user: null}`).
- Le **premier joueur** de `players` est l'admin.

### `room:players` (broadcast à tous les joueurs de la room)

```json
[
  { "username": "luffy", "avatar": "luffy", "faction": "pirate" },
  { "username": "garp", "avatar": "garp", "faction": "marine" }
]
```

À diffuser à chaque changement (join, leave, kick).

### `room:settings` (broadcast)

```json
{ "mode": "classic", "private": false }
```

### `room:list` (aux subscribers de la liste)

```json
[
  {
    "roomId": "maRoom",
    "playerCount": 2,
    "maxPlayers": 8,
    "mode": "classic",
    "isStarted": false
  }
]
```

### `game:start` (broadcast à tous les joueurs de la room)

```json
{
  "board":  [[0, 0, "T", "T", "T", 0, 0, 0, 0, 0]],
  "opponents": [
    { "username": "zoro", "board": [[0, 0, "I", "I", "I", "I", 0, 0, 0, 0]] }
  ],
  "currentPiece": { "type": "T" },
  "nextPiece":    { "type": "I" },
  "score":  0,
  "level":  1,
  "spectator": false
}
```

### `game:update` (au joueur concerné uniquement)

Même schéma que `game:start`. Émis après chaque action (`move`/`rotate`/`drop`) ou tick du joueur.

### `game:SpectatorGame` (au spectateur abonné)

Même schéma que `game:start`, **mais** :
- `spectator` = `string` (username du joueur observé), jamais `false`/`null`/`""`.
- À émettre **à chaque tick / chaque update du joueur observé**, pas seulement à l'abonnement.
- Stop dès que le client envoie `game:unsubscribeSpectatorGame` ou se déconnecte.

### `game:over` (broadcast à tous les joueurs + spectateurs)

```json
{
  "winner": "luffy",
  "scores": [
    { "username": "luffy", "score": 4200 },
    { "username": "zoro",  "score": 1800 }
  ]
}
```

- `winner` = string (gagnant) ou `null` (égalité / fin solo sans gagnant).

### `system:Error`

```json
{ "event": "room:join", "message": "Room not found" }
```

---

## 4. Contrat de la board

- Taille libre : le front lit `board.length` (rows) et `board[0].length` (cols) directement. Pas besoin d'envoyer de dimensions séparées.
- La pièce active est **déjà incluse** dans `board`. Pas de `x`/`y`/`rotation` à envoyer.
- Cellules acceptées :

| Valeur          | Sens                                |
|-----------------|--------------------------------------|
| `0`             | Cellule vide                         |
| `"I"` … `"Z"`   | Bloc de pièce (couleur dédiée front) |
| `"penalty"`     | Cellule de pénalité grise            |
| `"spectrum"`    | Cellule de spectre adverse (monochrome) |

### Plateaux adverses : spectre ou plateau réel

Le sujet impose qu'un joueur ne voie de ses adversaires que **la hauteur du bloc le plus haut
de chaque colonne**. Le contenu de `opponents[].board` dépend donc du destinataire :

| Destinataire | Événement | Contenu de `opponents[].board` |
|---|---|---|
| Un **joueur** en partie | `game:start`, `game:update` | **Spectre** : chaque colonne est remplie de `"spectrum"` depuis son bloc le plus haut jusqu'en bas. Ni couleurs, ni trous visibles. |
| Un **spectateur** | `game:SpectatorGame` | **Plateau réel**, couleurs et trous compris — un spectateur a le droit de tout voir. |

Le format reste le même (une grille 20×10) dans les deux cas : seul le contenu change, le front
n'a donc rien à faire de particulier, il rend `"spectrum"` en monochrome.

---

## 5. Solo

Convention : une room solo a un nom commençant par `sologame_` (ex : `sologame_3ztd5p`).

Le front affiche `level` **uniquement** dans ce cas. Le backend peut envoyer `level` toujours, ça ne dérange pas, mais c'est cette convention de nom qui détermine l'affichage côté UI.

---

## 6. Spectateur

Deux entrées possibles :

1. **Joueur arrive sur une room déjà lancée** :
   - Front envoie `room:join { roomId }`.
   - Back répond `room:joined { joined: false, players: [...] }`.
   - Front envoie automatiquement `game:subscribeSpectatorGame { roomId, user: null }`.
   - Back choisit le **premier joueur** dispo et envoie `game:SpectatorGame` avec `spectator: "<son-username>"`.

2. **Spectateur clique sur une board adverse** :
   - Front envoie `game:subscribeSpectatorGame { roomId, user: "zoro" }`.
   - Back change la cible et émet `game:SpectatorGame` avec `spectator: "zoro"`.

Le spectateur ne peut jamais émettre `game:move`/`rotate`/`drop` (le front l'empêche). Si jamais ça arrive, le back doit ignorer.

> **Garde-fou serveur** : un joueur **encore vivant** de la partie ne peut pas s'abonner
> comme spectateur — le back répond `system:Error { message: "Alive players cannot spectate" }`.
> Sans ce contrôle, n'importe quel joueur pourrait demander `game:SpectatorGame` (qui contient
> les plateaux réels) et contourner totalement le spectre imposé par le sujet.
> Seuls un joueur éliminé ou un socket extérieur à la partie peuvent spectater.

À la déconnexion / `game:unsubscribeSpectatorGame`, libérer les ressources et arrêter d'émettre.

---

## 7. Pièces

Les types valides côté front :

```
"I" | "J" | "L" | "O" | "S" | "T" | "Z"
```

Le front a sa propre config de shapes pour dessiner la preview de `nextPiece` (donc tu n'as pas besoin d'envoyer la forme, juste le type).