# Red Piece — Spécifications de jeu

Tout ce qui suit décrit le comportement **réellement implémenté**, avec la constante et
le fichier source correspondants. Les valeurs numériques vivent dans
`server/src/types/game/gameTypes.ts` (serveur, autoritatif) et sont reflétées côté
client dans `frontend/src/types/game.ts`.

Pour l'installation, les commandes et la conformité au sujet : **[README.md](README.md)**.

---

## Table des matières

1. [Le plateau](#1-le-plateau)
2. [Les pièces](#2-les-pièces)
3. [Chute, verrouillage, niveau](#3-chute-verrouillage-niveau)
4. [Contrôles](#4-contrôles)
5. [Nettoyage de lignes et pénalités](#5-nettoyage-de-lignes-et-pénalités)
6. [Barème de points](#6-barème-de-points)
7. [Les 7 modes de jeu](#7-les-7-modes-de-jeu)
8. [Rooms, hôte, cycle de vie d'une partie](#8-rooms-hôte-cycle-de-vie-dune-partie)
9. [Spectres et spectateurs](#9-spectres-et-spectateurs)
10. [Comptes, factions, avatars](#10-comptes-factions-avatars)
11. [Berrys et boutique](#11-berrys-et-boutique)
12. [Statistiques et classements](#12-statistiques-et-classements)
13. [Récapitulatif des constantes](#13-récapitulatif-des-constantes)

---

## 1. Le plateau

| Propriété | Valeur | Constante |
|---|---|---|
| Largeur | 10 colonnes | `BOARD_WIDTH` |
| Hauteur | 20 lignes | `BOARD_HEIGHT` |

Chaque joueur possède **son propre plateau**, stocké côté serveur dans
`Game.state: Map<socketId, PlayerGameState>`. Une cellule vaut :

| Valeur | Signification |
|---|---|
| `0` | vide |
| `"I"` … `"Z"` | bloc verrouillé, coloré selon la pièce d'origine |
| `"penalty"` | ligne de pénalité — **pleine et indestructible** |
| `"garbage"` | rangée de gruyère (mode Gruyère) — percée, donc nettoyable |
| `"spectrum"` | uniquement dans le spectre envoyé aux adversaires |

Trois grilles parallèles au plateau accompagnent chaque état :

- `lockedAt` — instant de verrouillage de chaque cellule (fondu du mode Invisible) ;
- `pieceIds` — quelle **pièce** a posé chaque cellule (gravité collante du mode Cascade) ;
- `fallBy` (temporaire) — distance parcourue par chaque case, pour animer les retombées.

Ces grilles sont décalées **exactement comme le plateau** à chaque nettoyage de ligne ou
remontée de pénalité : sinon les opacités et les regroupements se désynchroniseraient.

---

## 2. Les pièces

Les 7 tétriminos standard, chacun dans une **boîte carrée** (3×3, 4×4 pour le I, 2×2
pour le O) — `server/src/types/game/piecesGameTypes.ts`.

| Pièce | Forme | Couleur (thème par défaut) |
|---|---|---|
| **I** | barre de 4 | cyan `#22E6E6` |
| **J** | L inversé | bleu `#3B5BFF` |
| **L** | L | orange `#FF9F1C` |
| **O** | carré | jaune `#FFD23F` |
| **S** | S | vert `#2EE86E` |
| **T** | T | violet `#B14BFF` |
| **Z** | Z | rouge `#FF3B6B` |

**Pourquoi une boîte carrée.** La rotation fait pivoter la matrice autour du coin
haut-gauche. Avec une boîte rectangulaire (3×2), pivoter échange largeur et hauteur : le
centre se décale d'une demi-case à chaque quart de tour et la pièce « dérive ». Une
boîte carrée ne change pas de dimensions — c'est le principe du système SRS des Tetris
officiels.

### Distribution : le sac de 7

`Game.randomPiece()` produit un **sac** contenant les 7 types exactement une fois, dans
un ordre aléatoire. Les sacs sont concaténés dans `Game.pieceQueue`, **une seule file
pour toute la partie**. Chaque joueur avance sur cette file avec son propre
`pieceIndex`.

Conséquence directe, exigée par le sujet : **tous les joueurs d'une même partie
reçoivent la même séquence de pièces, aux mêmes positions**, même s'ils n'en sont pas au
même endroit. Et aucun joueur ne peut recevoir 5 barres I d'affilée.

Chaque pièce apparaît en `x = 4`, `y = 0`. Si la place est déjà prise : **top-out**, le
joueur est éliminé (`Game.canSpawn()`).

### Rotation et wall kicks

Une rotation qui ne tient pas à sa position est **décalée** avant d'être abandonnée.
`Game.ROTATION_KICKS` essaie les offsets dans cet ordre, le premier qui passe gagne :

```
(0,0) → (-1,0) (1,0) → (-2,0) (2,0) → (0,-1) (-1,-1) (1,-1) → (0,-2) → (-3,0) (3,0)
```

D'abord horizontal (décoller d'un mur ou d'une pile, le cas courant), puis un ou deux
crans **vers le haut** (*floor kick*). Sans ce dernier, une pièce posée au sol ne pouvait
plus pivoter à la verticale : la rotation ne faisait rien, ce qui se ressent comme un
bug. Le gain de hauteur est borné à 2 cases et la gravité reprend aussitôt — impossible
de « grimper » avec. Seul le I, long de 4, a besoin des ±3.

---

## 3. Chute, verrouillage, niveau

### Vitesse de chute

| Contexte | Cadence | Détail |
|---|---|---|
| **Multijoueur** | 400 ms — constante | tout le monde à la même vitesse |
| **Solo** | `max(80, 400 − (niveau − 1) × 40)` | s'accélère avec le niveau |
| **Sudden Death** | 120 ms fixes | `SUDDEN_DEATH_TICK_MS` |

`Game.getTickSpeed()`. En multijoueur la vitesse ne bouge jamais : la difficulté vient
des adversaires, pas de l'horloge.

### Niveau

Le niveau vaut `floor(lignes / 5) + 1` (`LINES_PER_LEVEL = 5`) et **ne progresse qu'en
solo** (`Game.updateLevel()`). En multijoueur il reste à 1, donc le multiplicateur de
score aussi : deux joueurs qui font le même mouvement marquent la même chose.

### Verrouillage : le sursis d'ajustement

Le sujet impose qu'une pièce touchant la pile ne se fige **qu'à la frame suivante**,
pour permettre les ajustements de dernière seconde. L'implémentation va un cran plus
loin :

```
sursis = max(250 ms, cadence de chute × 1.75)
```

`LOCK_GRACE_MIN_MS = 250`, `LOCK_GRACE_FACTOR = 1.75`.

Le sursis est mesuré **depuis le contact réel** (`groundedAt`), pas depuis le dernier
tick : une pièce amenée au contact juste avant un tick n'aurait sinon presque aucun
temps de réaction. Le facteur étant > 1, le minimum du sujet est toujours respecté.

Une pièce qui **retrouve de la place sous elle** (glissée au bord d'un surplomb, pivotée)
repart en chute — mais son sursis ne redémarre que si elle **descend réellement**.

`Game.refreshLockState()` mémorise dans `deepestY` la rangée la plus basse jamais
atteinte par la pièce courante. Le chronomètre ne repart que lorsqu'elle atteint une
rangée inédite. Sinon elle conserve son horodatage de contact et se verrouille dès
qu'elle retouche la pile.

C'est ce qui empêche une triche classique : le wall kick vertical décolle une pièce
posée, donc **pivoter en boucle** relançait le sursis à l'infini et la pièce ne se
verrouillait jamais — la partie ne pouvait plus se terminer. Faire tourner une pièce sur
place ne rapporte désormais aucune milliseconde ; seul le fait de la faire descendre en
donne. Test de non-régression : `server/src/core/Game.lockreset.test.ts`.

Le serveur envoie `lockInMs` au client à chaque frame : la jauge de verrouillage
affichée se remplit exactement au moment où la pièce se fige, même si le joueur bouge la
pièce entre deux ticks.

---

## 4. Contrôles

| Action | Touche par défaut | Effet |
|---|---|---|
| Déplacer à gauche | `←` | une colonne |
| Déplacer à droite | `→` | une colonne |
| Rotation | `↑` | quart de tour horaire, avec wall kicks |
| Accélérer la chute | `↓` | *soft drop* — une ligne, **+1 point** |
| Faire tomber la pièce | `Espace` | *hard drop* — jusqu'en bas, **+2 points/case**, verrouillage immédiat |
| Joker | `J` | révèle le plateau (mode Invisible uniquement) |

**Toutes les touches sont reconfigurables** (écran « Touches ») et persistées en
`localStorage`. On stocke le `KeyboardEvent.code` — la touche *physique* — pour que le
jeu se comporte pareil en AZERTY et en QWERTY ; l'affichage utilise le caractère
réellement imprimé sur la touche.

**Auto-répétition maison.** Le jeu n'utilise pas l'auto-repeat de l'OS (délai initial
~500 ms, cadence variable selon la machine). Chaque action tenue a son propre couple
délai/cadence — `GameView.tsx` :

| Action | Délai avant répétition | Cadence |
|---|---|---|
| Déplacement latéral (DAS/ARR) | 120 ms | 35 ms |
| Soft drop | 90 ms | 35 ms |
| Rotation | 130 ms | 45 ms |

Un tapotement bref ne déclenche donc qu'**une seule** action : le `keyup` annule le
timer avant le délai.

---

## 5. Nettoyage de lignes et pénalités

### Nettoyage

Une rangée est nettoyée si **toutes** ses cellules sont remplies **et** qu'elle ne
contient aucune cellule `"penalty"`. Les rangées au-dessus redescendent d'un bloc, avec
leurs grilles `lockedAt` et `pieceIds`.

### Pénalités — la règle du sujet

Nettoyer **n** lignes envoie **n − 1** lignes de pénalité à **chaque adversaire vivant**
(`Game.addPenaltyToOpponents()`) :

| Lignes nettoyées | Pénalité envoyée |
|---|---|
| 1 | 0 |
| 2 | 1 |
| 3 | 2 |
| 4 (*Tetris*) | 3 |

Une ligne de pénalité est **pleine sur les 10 colonnes**, sans la moindre brèche. Deux
verrous garantissent qu'elle est indestructible :

1. `clearLines()` **exclut** toute rangée contenant une cellule `"penalty"` ;
2. elle est pleine, donc jamais « complétable » par le joueur.

**Aucune pénalité en solo** (`Game.isSolo()`).

### Ce que la pénalité déclenche

La pénalité fait **remonter tout le plateau** (`Game.raiseBoard()`) :

- si les rangées qui sortent par le haut portent le moindre bloc → **top-out**, la
  victime est éliminée. Sans ce contrôle, une pénalité « nettoierait » gratuitement le
  sommet d'une pile haute au lieu de la punir ;
- la **pièce en vol remonte avec le plateau**, sinon elle se retrouverait incrustée dans
  les lignes ajoutées et, au verrouillage, écraserait des cellules `"penalty"` — la ligne
  perdrait son marqueur et redeviendrait nettoyable ;
- la victime (et ses spectateurs) reçoit le plateau **avant** toute élimination : elle
  voit les lignes qui viennent de la tuer.

---

## 6. Barème de points

> Le sujet ne demande **aucun** système de points (« le dernier joueur en lice remporte
> la partie »). Le score est un **bonus** : il ne décide jamais du vainqueur, sauf en
> mode Ultra où c'est la règle annoncée du mode.

### Lignes nettoyées

Barème *Tetris Guideline* (`LINE_CLEAR_SCORES`), indexé par le nombre de lignes faites
**d'un seul coup** :

| Lignes d'un coup | Points de base | × niveau 2 | × niveau 3 |
|---|---|---|---|
| 1 (*Single*) | 100 | 200 | 300 |
| 2 (*Double*) | 300 | 600 | 900 |
| 3 (*Triple*) | 500 | 1 000 | 1 500 |
| 4 (**Tetris**) | **800** | 1 600 | 2 400 |

```
points = LINE_CLEAR_SCORES[lignes] × niveau × maillon_de_chaîne
```

La prime aux multi-lignes est la mécanique centrale : **un Tetris rapporte 8× un
Single**, pas 4×. C'est ce qui récompense le joueur qui creuse un puits et attend la
barre I au lieu d'aplanir sa pile.

`maillon_de_chaîne` vaut toujours 1 hors mode Cascade (voir §7).

### Descente volontaire

Non multipliés par le niveau, et comptés **par case réellement parcourue** —
marteler la touche contre le sol ne rapporte rien :

| Action | Points par case | Constante |
|---|---|---|
| Soft drop (`↓`) | **1** | `SOFT_DROP_POINTS_PER_CELL` |
| Hard drop (`Espace`) | **2** | `HARD_DROP_POINTS_PER_CELL` |

C'est ce qui récompense le joueur qui ne laisse pas la gravité faire le travail.

### Ce que le score devient

En fin de partie, **le score de chaque joueur est crédité en berrys** sur son compte
(`shopService.settleGameRewards()`) — vainqueur ou non. Le score est aussi enregistré
dans l'historique (`GameRecord`) pour les statistiques et les classements.

---

## 7. Les 7 modes de jeu

Le mode est choisi par l'**hôte** dans le lobby (`room:setMode`), et ne peut plus changer
une fois la partie lancée.

### Classique

Les règles de base du sujet.

- Pénalités *n − 1* aux adversaires.
- **Le dernier joueur en vie gagne.**
- Jouable de 1 à 4 joueurs. En solo, le niveau (et donc la vitesse) monte toutes les
  5 lignes.

### Sprint — *la course*

- Objectif : **le premier à 40 lignes** (`SPRINT_TARGET_LINES`).
- **Minimum 2 joueurs** : c'est une course, elle n'a pas de sens en solo. Le serveur
  refuse le lancement en dessous (`room:start` → erreur explicite).
- Vitesse constante à 400 ms pour tout le monde.
- Un joueur **mort** ne peut pas gagner, même s'il a franchi l'objectif en top-outant.

### Ultra — *le contre-la-montre*

- Partie chronométrée : **2 minutes** (`ULTRA_DURATION_MS = 120 000`).
- **Le meilleur score à l'expiration l'emporte** — c'est le seul mode où le score
  décide du vainqueur.
- La règle de survie ne clôt **pas** la partie avant l'expiration : sinon la première
  élimination sacrerait le survivant au lieu du meilleur scoreur.
- Un joueur qui **quitte** la partie est hors classement : sinon il suffirait de marquer
  puis de partir pour être sacré.
- En solo : pas de vainqueur déclaré (une partie sans adversaire ne compte pas comme une
  victoire dans les statistiques).
- Stratégie : viser les Tetris. 800 points contre 400 pour les mêmes 4 lignes faites une
  par une.

### Sudden Death

- **Vitesse maximale dès la première pièce** : 120 ms par ligne, pour tout le monde.
- La progression de niveau est désactivée — la cadence ne bouge jamais.
- Une seule vie, le plus endurant gagne.

### Invisible

- Une pièce verrouillée **s'efface progressivement** et devient totalement invisible au
  bout de **3 s** (`INVISIBLE_FADE_MS`)… mais **reste solide**. Les collisions ne
  changent pas.
- Chaque ligne complétée **redonne 2 s de visibilité totale**
  (`INVISIBLE_REVEAL_PER_LINE_MS`), cumulables, puis le fondu reprend normalement.
- La visibilité « en banque » est **plafonnée à 6 s** (`INVISIBLE_REVEAL_CAP_MS`) : sans
  ce plafond, enchaîner les lignes garderait le plateau visible en permanence et
  annulerait le mode.
- **3 jokers** par partie (`INVISIBLE_JOKER_COUNT`), touche `J`, révélant le plateau
  **3 s** chacun. Un joker dont le gain serait rogné par le plafond n'est pas consommé.
- Les cases vides et les lignes de pénalité **restent toujours visibles** (elles n'ont
  pas d'horodatage de verrouillage).
- Le spectre envoyé aux adversaires est calculé sur le plateau **masqué** : personne ne
  peut lire par le spectre une hauteur que le joueur lui-même ne voit plus.

### Cascade — *les chaînes*

- Après chaque nettoyage, les blocs qui ne reposent plus sur rien **retombent**, ce qui
  peut compléter de nouvelles lignes : c'est une **chaîne**.
- **Chaque maillon multiplie le score** : la 2ᵉ salve vaut ×2, la 3ᵉ ×3, etc. C'est
  toute la récompense du mode.
- La gravité est **collante et par pièce** : chaque amas de cellules issues de la *même*
  pièce tombe d'un seul tenant. Une pièce coupée en deux par une ligne nettoyée donne
  bien deux amas, chaque morceau tombant de son côté.
  - Pourquoi pas « par contact » : dans une vraie partie tout se touche, la pile
    formerait un seul bloc soudé et plus rien ne tomberait jamais.
  - Pourquoi pas « case par case » : mesuré, ça déclenche plus souvent (62 % des
    nettoyages contre 41 %) mais **rebouche tous les trous** à chaque ligne, rendant le
    mode deux fois plus permissif que le Classique. Choix de jeu : un pont posé garde le
    trou qu'il recouvre.
- Les lignes de **toute la chaîne** sont additionnées avant le calcul de la pénalité
  *n − 1* envoyée aux adversaires.
- Le serveur transmet la **distance parcourue** par chaque case (`cascade.cells`) pour
  que le client anime la retombée depuis la bonne position.

### Gruyère (*Cheese*)

- Le plateau démarre avec **10 rangées de gruyère** (`CHEESE_START_GARBAGE`) : pleines
  sauf **un trou**, donc nettoyables — contrairement aux pénalités.
- Objectif : **creuser les 20 rangées** de la partie (`CHEESE_TOTAL_GARBAGE`).
- Toutes les **2 rangées creusées** (`CHEESE_CLEARS_PER_RISE`), le plateau **remonte**
  d'une nouvelle rangée. La cadence « 2 creusées pour 1 servie » fait gagner du terrain :
  sinon la course serait interminable.
- La colonne du trou est **tirée une seule fois pour toute la partie** et partagée par
  tous les joueurs : une course doit servir exactement le même plateau à tout le monde,
  comme la file de pièces. **Deux rangées consécutives n'ont jamais le même trou**, sinon
  une seule barre I les nettoierait ensemble.
- Le compteur « À creuser » décompte les 20 rangées, celles qui attendent en coulisse
  comprises — il ne remonte donc jamais quand le plateau se soulève.
- Jouable en solo (contre-la-montre) comme à plusieurs (le premier à finir gagne ; en
  solo, pas de vainqueur déclaré).

### Tableau comparatif

| Mode | Joueurs min. | Fin de partie | Vitesse |
|---|---|---|---|
| Classique | 1 | dernier en vie | 400 ms, accélère en solo |
| Sprint | **2** | premier à 40 lignes | 400 ms constante |
| Ultra | 1 | expiration des 2 min → meilleur score | 400 ms, accélère en solo |
| Sudden Death | 1 | dernier en vie | **120 ms** constante |
| Invisible | 1 | dernier en vie | 400 ms, accélère en solo |
| Cascade | 1 | dernier en vie | 400 ms, accélère en solo |
| Gruyère | 1 | premier à creuser 20 rangées | 400 ms, accélère en solo |

---

## 8. Rooms, hôte, cycle de vie d'une partie

### Rejoindre

L'URL `http://<serveur>:<port>/<room>/<player_name>` crée la room si elle n'existe pas,
ou y fait entrer le joueur. Le nom de room est limité à **15 caractères**
(`[a-zA-Z0-9_]`).

Une room accepte **4 joueurs maximum** (`MAX_PLAYERS_PER_ROOM`). **Plusieurs parties
tournent simultanément** : chaque room a sa propre `Game` et sa propre boucle de gravité.

### L'hôte

Le **premier joueur arrivé** devient hôte. Lui seul peut :

- lancer (`room:start`) ou relancer (`room:restart`) la partie ;
- choisir le mode (`room:setMode`) ;
- basculer la room en privée/publique (`room:setPrivate`) ;
- exclure un joueur (`room:kick`).

**Si l'hôte part, le rôle passe au joueur suivant** (`Room.removePlayer()`). Le client
dérive l'admin de `players[0]`, et le serveur maintient l'invariant
`hostPlayerId === players[0]`.

### Rooms privées et appartenance

Une room privée n'accepte que ses **membres** — les pseudos qui l'ont déjà rejointe.
L'appartenance est **par pseudo**, pas par socket : elle survit à un rafraîchissement de
page ou à une coupure réseau. Un inconnu qui force l'URL reçoit `room:denied`.

Un **kick** révoque l'appartenance : le joueur exclu redevient un inconnu. Un simple
départ, non. L'auto-kick est interdit (il viderait la room sans la supprimer, rendant son
nom injoignable pour tout le monde).

Les rooms **solo** (`sologame_*`) sont forcées privées et non modifiables.

### Lancement et fin

1. `room:start` → la room passe en `playing` **immédiatement** : plus aucun joueur ne
   peut entrer, ni un second start s'intercaler.
2. Décompte **3 – 2 – 1** diffusé à tous (`game:countdown`), une valeur par seconde.
3. `Game.start()` → `game:start`, puis la boucle de gravité démarre.
4. Fin : `game:over` avec le vainqueur et les scores. La room repasse en `waiting`, prête
   pour une nouvelle manche.

**Reconnexion.** Après une coupure brutale, le socket mort d'un joueur occupe encore sa
place jusqu'au `pingTimeout` de socket.io. Si la room est pleine, on évince ce fantôme
plutôt que d'éjecter un membre de sa propre room. L'hôte qui se reconnecte ainsi perd
son rôle : il est réinséré en fin de liste, et le rôle suit la position.

**Robustesse.** Une exception dans un tick de gravité ou dans le décompte n'a aucun
appelant pour la rattraper : elle tuerait le process, donc **toutes** les parties
simultanées. Chaque boucle est isolée dans un `try/catch` qui confine la panne à la room
fautive, arrête sa gravité, rouvre la room et prévient ses joueurs.

---

## 9. Spectres et spectateurs

### Le spectre

Chaque joueur voit, à côté de son plateau, le **spectre** de chacun de ses adversaires,
mis à jour en temps réel (`getSpectrumBoard()`).

Le spectre ne garde, pour chaque colonne, que la **hauteur du bloc le plus haut**,
remplie jusqu'en bas avec un marqueur neutre. Un joueur ne voit donc **ni les couleurs**
de ses adversaires, **ni les trous** sous leur pile — exactement ce que demande le
sujet.

### Les spectateurs

Un joueur **éliminé** bascule automatiquement en spectateur et peut suivre les plateaux
**complets** (pas les spectres) des joueurs encore en lice. N'importe qui peut aussi
s'abonner à une partie en cours depuis le dashboard
(`game:subscribeSpectatorGame`).

Les abonnements spectateur sont purgés à la fin de chaque partie, mais **après**
l'émission de `game:over` : sinon les spectateurs purs resteraient bloqués sur un plateau
figé, sans récapitulatif ni retour au lobby.

---

## 10. Comptes, factions, avatars

À la première connexion, un joueur choisit un **pseudo** (1 à 15 caractères,
`[a-zA-Z0-9_]`, unique), puis une **faction** et un **avatar** :

| Faction | Avatars |
|---|---|
| 🏴‍☠️ **Pirate** | Luffy, Zoro, Nami, Usopp, Sanji, Chopper, Robin, Franky, Brook, Jinbei |
| ⚓ **Marine** | Garp, Sengoku, Akainu, Aokiji, Kizaru, Fujitora, Ryokugyu, Smoker, Tashigi, Koby |

Le choix habille toute l'interface : décor de dashboard en parallaxe, couleurs, écrans de
transition. Il alimente aussi le classement des factions.

Un pseudo déjà **connecté** sur un autre socket est refusé : deux onglets ne peuvent pas
jouer sous la même identité.

---

## 11. Berrys et boutique

Les **berrys** sont la monnaie du jeu. Ils sont crédités en fin de partie, à hauteur du
**score réalisé**, pour chaque joueur — vainqueur ou non.

Ils s'échangent contre des **thèmes de pièces**, qui changent la palette et le rendu du
plateau. Le catalogue et les prix sont **autoritatifs côté serveur**
(`server/src/config/shopThemes.ts`) : le client ne fait que les afficher, l'achat est
toujours revalidé.

| Thème | Prix | Rendu |
|---|---|---|
| **Neon Gem** | **gratuit** (par défaut) | gemmes translucides, biseau lumineux, halo coloré |
| **Daltonien** | 12 000 | palette Okabe-Ito, distinguable en daltonisme |
| **Soft Pastel** | 25 000 | flat doux, dégradé zénithal, coins arrondis |
| **Verre Liquide** | 40 000 | verre dépoli, rim-light blanc, reflet spéculaire |
| **Synthwave** | 50 000 | néon rétro-arcade, cœur blanc, gros halo |
| **Joyaux** | 75 000 | cristaux sombres à cœur lumineux et facettes |

Repère d'équilibrage : le thème le plus cher vaut **environ quatre bonnes parties solo**.

Le thème équipé est **cosmétique** et suit le joueur : les spectateurs voient son plateau
avec son thème à lui.

---

## 12. Statistiques et classements

Chaque partie terminée écrit une ligne par joueur dans `GameRecord` — **la source de
vérité**. Les colonnes agrégées sur `User` et `FactionStats` n'en sont qu'un cache
d'affichage, recalculé en fin de partie pour éviter un `GROUP BY` sur tout l'historique
à chaque lecture.

### Statistiques personnelles

Parties jouées, victoires, défaites, **ratio de victoires**, meilleur score, lignes
totales, **Tetris** réalisés (4 lignes d'un coup), temps de jeu cumulé.

Une partie **solo** ou sans vainqueur ne compte **pas** comme une défaite : `hadWinner`
distingue une vraie défaite d'une partie non décisive.

### Classements

- **Top score** — meilleur score absolu
- **Top victoires**
- **Top Tetris**
- **Top lignes**
- **Par mode de jeu** — un classement dédié pour chacun des 7 modes
- **Factions** — Pirates contre Marine : victoires, défaites, Tetris, lignes, meilleur
  score, et « le meilleur camp » (null en cas d'égalité)

---

## 13. Récapitulatif des constantes

`server/src/types/game/gameTypes.ts` — source unique de vérité.

| Constante | Valeur | Rôle |
|---|---|---|
| `BOARD_WIDTH` | 10 | largeur du plateau |
| `BOARD_HEIGHT` | 20 | hauteur du plateau |
| `LINE_CLEAR_SCORES` | `[0, 100, 300, 500, 800]` | barème par nombre de lignes d'un coup |
| `SOFT_DROP_POINTS_PER_CELL` | 1 | points par case en soft drop |
| `HARD_DROP_POINTS_PER_CELL` | 2 | points par case en hard drop |
| `LINES_PER_LEVEL` | 5 | lignes pour monter d'un niveau (solo) |
| `LOCK_GRACE_FACTOR` | 1.75 | sursis de verrouillage, en frames de gravité |
| `LOCK_GRACE_MIN_MS` | 250 | plancher du sursis |
| `SPRINT_TARGET_LINES` | 40 | objectif du mode Sprint |
| `ULTRA_DURATION_MS` | 120 000 | durée du mode Ultra |
| `SUDDEN_DEATH_TICK_MS` | 120 | cadence du mode Sudden Death |
| `INVISIBLE_FADE_MS` | 3 000 | durée du fondu d'une pièce posée |
| `INVISIBLE_REVEAL_PER_LINE_MS` | 2 000 | visibilité rendue par ligne complétée |
| `INVISIBLE_REVEAL_CAP_MS` | 6 000 | plafond de visibilité en banque |
| `INVISIBLE_JOKER_COUNT` | 3 | jokers par partie |
| `INVISIBLE_JOKER_REVEAL_MS` | 3 000 | durée d'une révélation par joker |
| `CHEESE_TOTAL_GARBAGE` | 20 | rangées de gruyère à creuser |
| `CHEESE_START_GARBAGE` | 10 | rangées posées au coup d'envoi |
| `CHEESE_CLEARS_PER_RISE` | 2 | rangées creusées avant une remontée |
| `MAX_PLAYERS_PER_ROOM` | 4 | capacité d'une room (`core/room.ts`) |
