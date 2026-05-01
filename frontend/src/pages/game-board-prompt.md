# Prompt Frontend - Page De Jeu Tetris

Implemente la vraie page de jeu Tetris cote frontend, dans le theme existant de la page room.

## Contexte

- Projet React/Vite.
- Garder le theme visuel de la room : fond sombre avec image floutee, panels glass, bordures `var(--color-glass-border)`, texte `var(--color-text-on-dark)` / `var(--color-text-muted-on-dark)`.
- Pas de theme blanc, pas de cards classiques blanches.
- Pas de version mobile a gerer pour l'instant.
- Pas de Canvas. Rendu en HTML/CSS grid.

## Objectif

Creer une belle page de board de jeu qui consomme les events WS existants et affiche :

- board principale au centre
- score au-dessus de la board principale, centre
- level en haut a droite de la board principale, seulement en solo
- next piece a droite en haut de la board
- boards adverses en petit autour de la board
- game over avec resultat et scores

## Layout

- Board principale au centre.
- Score centre au-dessus de la board principale.
- Level positionne en haut a droite de la board principale, uniquement si la room est solo.
- Next piece a droite de la board principale, en haut.
- Boards adverses :
  - d'abord a gauche de la board principale, empilees verticalement
  - chaque mini-board affiche le pseudo du joueur au-dessus
  - si ca depasse la hauteur de la board principale, placer les adversaires suivants a droite, sous le panel next piece
  - si ca depasse encore, mettre un scroll vertical uniquement sur le bloc adversaires de droite

## Mode Solo

Une room solo a toujours un nom commencant par `sologame_`, par exemple `sologame_3ztd5p`.

Afficher `level` seulement si :

```ts
roomName.startsWith("sologame_")
```

## Contrat WS Game State

Les events `game:start`, `game:update`, et `game:SpectatorGame` peuvent renvoyer :

```json
{
  "board": [[0, "T"]],
  "opponents": [
    { "username": "zoro", "board": [[0, "I"]] }
  ],
  "currentPiece": { "type": "T" },
  "nextPiece": { "type": "I" },
  "score": 0,
  "level": 1,
  "spectator": false
}
```

## Spectator

`spectator` :

- `false` signifie que le joueur joue sa propre partie.
- une string signifie que le joueur est spectateur et contient le pseudo du joueur regarde.

Exemple :

```json
{
  "spectator": "luffy"
}
```

signifie qu'il regarde `luffy`.

## Board

- La taille de la board vient directement du payload :
  - rows = `board.length`
  - cols = `board[0]?.length`
- Ne pas utiliser `boardRows` ou `boardCols`.
- La board contient deja la piece active.
- Ne pas utiliser `x`, `y`, `rotation`.
- Les cellules possibles :
  - `0` : vide
  - `"I" | "J" | "L" | "O" | "S" | "T" | "Z"` : bloc de piece
  - `"penalty"` : cellule de penalite grise
- Prevoir une compatibilite temporaire avec :
  - `1` : bloc rempli generique
  - `2` : penalite
- Les couleurs/images des cellules doivent etre faciles a modifier via une config centrale frontend.
- Prevoir une config permettant soit une couleur, soit une image de fond par type de cellule.
- Rendu visuel des cellules : effet glass/neon/arcade propre, pas plat.

## Next Piece

Le backend envoie seulement :

```json
{ "type": "I" }
```

Dupliquer cote frontend une config minimale des shapes :

- I
- J
- L
- O
- S
- T
- Z

Dessiner la preview next piece a partir de cette config.

Utiliser la meme config de couleurs/images que les cellules de board.

## Controles

- Pour l'instant clavier uniquement.
- Le joueur normal peut envoyer :
  - `game:move` avec `{ "direction": "left" | "right" | "down" }`
  - `game:rotate`
  - `game:drop`
- Si `spectator !== false`, ne jamais envoyer ces events.
- Pas besoin de boutons de controle a l'ecran pour l'instant.

## Flow Joueur

- Le flux existant `room:join` reste utilise.
- Si `room:joined` indique que le joueur a rejoint normalement, il reste joueur.
- Le joueur recoit ensuite `game:start` / `game:update`.

## Flow Spectateur

Cas important : un utilisateur arrive sur une URL de room alors que la game est deja lancee.

- Le front envoie quand meme `room:join`.
- Le backend repond `room:joined` avec `joined: false`.
- Dans ce cas, le front doit envoyer automatiquement :

```json
{
  "roomId": "ma-room",
  "user": null
}
```

sur l'event :

```txt
game:subscribeSpectatorGame
```

`user: null` signifie premiere entree spectateur : le backend choisit le premier joueur de la liste.

Si le spectateur clique sur une board adverse :

```json
{
  "roomId": "ma-room",
  "user": "zoro"
}
```

sur l'event :

```txt
game:subscribeSpectatorGame
```

Ce clic n'est autorise que si `spectator !== false`.

Si le joueur n'est pas spectateur, les boards adverses ne doivent pas etre cliquables.

## Refresh Spectateur

Si le client est spectateur et actualise/quitte la page, envoyer :

```txt
game:unsubscribeSpectatorGame
```

avec :

```json
{}
```

Ne pas redirect dashboard.

Au retour sur la page, le flow normal relancera `room:join`.

Si la game est deja lancee, `room:joined` repondra `joined: false`, puis le front renverra `game:subscribeSpectatorGame` avec `user: null`.

## Game Over

Ecouter `game:over`.

Payload fiable d'apres la ws-docs :

```json
{
  "winner": "luffy",
  "scores": [
    { "username": "luffy", "score": 4200 },
    { "username": "zoro", "score": 1800 }
  ]
}
```

Afficher une belle vue game over dans le meme theme :

- titre win/lose selon le winner et le joueur actuel
- afficher le winner
- afficher le classement des scores
- bouton retour dashboard

## Pas De Loading Special

- Pas besoin d'un ecran loading avant `game:start`.
- Garder le flux actuel tant qu'aucun state de game n'est recu.

## Architecture Frontend Attendue

Creer des types frontend pour le game state :

- `GameBoardCell`
- `GameBoard`
- `OpponentBoard`
- `GameStatePayload`
- `GameOverPayload`

Creer un normalizer robuste pour les payloads WS :

- ignore les payloads invalides
- accepte cellules `0`, `1`, `2`, strings de pieces, `"penalty"`
- normalise `spectator`

Creer une config centrale :

- `PIECE_SHAPES`
- `CELL_THEME`
- helper `getCellTheme(cell)`

Creer des composants propres :

- `GameBoard`
- `MiniBoard`
- `NextPiecePreview`
- `GameHud`
- `OpponentsColumn`
- `GameOverView`

Integrer dans `GamePage.tsx` sans casser le lobby existant.

Garder les styles coherents avec `styles.css` et le theme de `.game-lobby`.

## Contraintes

- Ne pas modifier le backend.
- Ne pas modifier la ws-docs sauf si strictement necessaire.
- Ne pas toucher aux flows auth/username.
- Ne pas casser le lobby room existant.
- Ne pas utiliser Canvas.
- Ne pas creer une landing page.

## Verification

Apres modification, lancer :

```sh
npm run build
```

dans `frontend`.

Puis lancer a la racine si disponible :

```sh
graphify update .
```
