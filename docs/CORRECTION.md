# Commandes utiles pour la correction

Aide-mémoire pour la soutenance : ce qu'on tape, et ce que ça prouve.
Vue d'ensemble : [README](../README.md)

## 1. Lancer le jeu

```bash
make prod        # mode de référence : le serveur Node sert la SPA + le socket
```

Puis ouvrir une URL de partie :

```
http://localhost:3000/dressrosa/luffy      -> /<room>/<player_name>
```

Ouvrir la même URL de room avec un autre pseudo dans un 2e onglet pour le multi.
Le **premier arrivé est l'hôte** et lance la partie.

```bash
make dev         # hot reload — le front est sur :5173, le back ne sert PAS la SPA
make prod-down   # arrêter
make clean       # tout supprimer (conteneurs, volumes)
```

## 2. Tests + couverture

```bash
make test               # les deux suites
make test-server        # serveur seul
make test-front         # frontend seul
```

Attendu : 688 tests serveur + 646 frontend, tout vert.
Les seuils du sujet (70/50/70/70) sont **écrits dans les deux `vitest.config.ts`** :
la commande échoue d'elle-même si la couverture retombe dessous.

## 3. Vérifier les contraintes du sujet

```bash
# Pas de `this` côté client, aucune classe
grep -rn '\bthis\b' frontend/src --include='*.ts' --include='*.tsx'
grep -rnE '^\s*(export\s+)?class\s' frontend/src

# Serveur orienté objet (Player, Piece, Game, Room)
grep -rnE '^\s*(export\s+)?class\s+\w+' server/src/core

# Ni canvas, ni SVG, ni jQuery, ni <table>
grep -rniE '\b(canvas|jquery)\b|<svg|<table' frontend/src

# Aucun secret versionné
git ls-files | grep -i env        # ne doit renvoyer que .env.example

# Plateau 10 x 20
grep -n 'BOARD_WIDTH\|BOARD_HEIGHT' server/src/types/game/gameTypes.ts
```

## 4. Vérifier que le serveur sert bien le front (exigence du sujet)

Stack prod lancée, dans un autre terminal :

```bash
curl -I http://localhost:3000/                    # 200, text/html
curl -I http://localhost:3000/dressrosa/luffy     # 200, même index.html (fallback SPA)
curl -s http://localhost:3000/ | grep assets      # le bundle JS + le CSS
# handshake socket.io : bien un GET, un HEAD (-I) renverrait 400
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/socket.io/?EIO=4&transport=polling"
```

Tout est sur **le même port** : une seule origine pour la SPA et le socket.

## 5. Pièges à connaître

- `make dev` ne sert pas la SPA depuis le backend, c'est **normal** (Vite s'en charge).
  Pour l'exigence « le serveur sert index.html », c'est `make prod`.
- Les lignes de pénalité partent en mode **classique** et sprint. Démo en classique.
- `server/src/generated/prisma/` n'est pas versionné : le `Makefile` le génère tout seul
  au premier `make test`, un clone frais suffit.
