# Red Tetris

Projet de Tetris multijoueur en temps réel, développé en **full-stack JavaScript/TypeScript**.

## Démarrage rapide frontend

Le frontend est maintenant prêt avec deux modes Docker Compose, sans modification du dossier `server`.

### Développement avec hot reload

```bash
make dev
```

Le frontend Vite est ensuite accessible sur `http://localhost:5180`.

### Production

```bash
make prod
```

Le build de production est servi par Nginx sur `http://localhost:8080`.

### Structure ajoutée

- `frontend/` contient l'application React + TypeScript + Vite
- `frontend/Dockerfile` gère le mode dev et le build de prod
- `frontend/nginx.conf` sert la SPA en production
- `docker-compose.yml` expose un profil `dev` et un profil `prod`
- `Makefile` ajoute des commandes simples pour piloter les deux modes

L’objectif est de proposer une application web moderne, proprement structurée, avec :
- un **frontend SPA** réactif,
- un **backend Node.js** temps réel,
- une communication **HTTP + WebSocket via Socket.IO**,
- une **base de données PostgreSQL** pour la persistance des données utiles hors gameplay temps réel,
- une architecture claire, testable et évolutive.

Le sujet impose notamment :
- une stack **entièrement JavaScript** (TypeScript autorisé),
- un **client SPA**,
- un **serveur Node.js**,
- une communication **HTTP + socket.io**,
- un rendu sans **Canvas** ni **SVG**,
- une mise en page en **Grid/Flexbox**,
- et aucune persistance obligatoire pour la partie mandatory. :contentReference[oaicite:0]{index=0}

---

## 1. Notre stack technique

### Frontend
- **React**
- **TypeScript**
- **Vite**
- **React Router**
- **Redux Toolkit**
- **Tailwind CSS**
- **shadcn/ui**
- **Motion**

### Backend
- **Node.js**
- **Express**
- **Socket.IO**

### Base de données
- **PostgreSQL**
- **Prisma ORM**

### Tests
- **Vitest**
- **React Testing Library**
- **Playwright**

---

## 2. Pourquoi cette stack

### React
React est un excellent choix pour construire une interface dynamique et modulaire.  
Il permet de découper l’application en composants clairs : lobby, grille du joueur, spectres adverses, scoreboard, modales, écran de fin de partie, etc.

### TypeScript
TypeScript sécurise le projet en ajoutant du typage statique.  
C’est particulièrement utile sur un projet réseau et temps réel, car on manipule beaucoup de structures de données :
- joueurs,
- rooms,
- pièces,
- état du board,
- événements Socket.IO,
- réponses API.

Le sujet autorise explicitement TypeScript. :contentReference[oaicite:1]{index=1}

### Vite
Vite permet un démarrage rapide du frontend, un build propre et une excellente expérience de développement.  
C’est un très bon choix pour une SPA React moderne.

### React Router
Le sujet demande un routage du type :

`/<room>/<player_name>`

React Router permet de gérer proprement ces routes côté client, ainsi que les pages annexes comme :
- `/`
- `/login`
- `/register`
- `/lobby`
- `/room/:roomName/:playerName`

Le sujet mentionne l’usage de routeurs adaptés comme BrowserRouter ou MemoryRouter. :contentReference[oaicite:2]{index=2}

### Redux Toolkit
Redux Toolkit sert à gérer l’**état global** de l’application de façon propre et moderne.

On l’utilise pour centraliser :
- les informations utilisateur,
- la room courante,
- les joueurs connectés,
- le statut de la partie,
- les états UI globaux,
- certaines données synchronisées venant du serveur.

Pourquoi Redux Toolkit plutôt que Redux “classique” :
- moins de boilerplate,
- structure plus lisible,
- reducers plus simples,
- meilleure maintenabilité.

### Tailwind CSS
Tailwind permet de construire rapidement une interface moderne, cohérente et responsive.

Il est utile pour :
- les layouts globaux,
- les écrans de lobby,
- les cartes utilisateur,
- les boutons,
- les panels d’information,
- les modales,
- les états visuels.

### shadcn/ui
shadcn/ui apporte une base de composants élégants et réutilisables :
- dialogs,
- dropdowns,
- forms,
- buttons,
- toasts,
- tabs,
- sheets.

Cela évite de réinventer toute la couche UI tout en gardant une bonne personnalisation.

### Motion
Motion permet d’ajouter des animations fluides :
- apparition/disparition de panels,
- transitions de modales,
- feedback visuel,
- animations UI de lobby et de fin de partie.

### Node.js + Express
Le backend doit être en JavaScript côté serveur, et le sujet impose un serveur Node.js. :contentReference[oaicite:3]{index=3}

Express est utilisé pour :
- servir le frontend buildé,
- exposer les routes HTTP,
- gérer l’authentification et les endpoints classiques,
- préparer l’intégration avec Socket.IO.

### Socket.IO
Socket.IO est la pièce centrale du **temps réel**.

Il servira à :
- connecter les joueurs à une room,
- synchroniser l’état de partie,
- diffuser les mouvements,
- envoyer les updates de spectres,
- démarrer/restart une partie,
- gérer les départs/reconnexions.

Le sujet impose une communication via **HTTP et socket.io**. :contentReference[oaicite:4]{index=4}

### PostgreSQL
PostgreSQL est utilisé pour la **persistance** :
- comptes utilisateurs,
- historique de parties,
- scores,
- statistiques,
- leaderboard,
- profils.

Important : la base de données **ne pilote pas le gameplay temps réel**.  
La partie active doit rester **en mémoire côté serveur** pour éviter de ralentir ou complexifier inutilement la logique.

### Prisma
Prisma facilite :
- la définition du schéma,
- les migrations,
- les requêtes typées,
- l’intégration propre avec TypeScript.

C’est un très bon choix pour garder une couche base de données claire et maintenable.

### Vitest + React Testing Library + Playwright
Le sujet demande une bonne couverture de tests :
- au moins 70 % de statements, functions et lines,
- au moins 50 % de branches. :contentReference[oaicite:5]{index=5}

Notre stratégie :
- **Vitest** pour les tests unitaires,
- **React Testing Library** pour tester les composants,
- **Playwright** pour les tests end-to-end.

---

## 3. Vision d’architecture

L’application est organisée autour de trois blocs principaux :

### 1. Le client web
Le client React affiche :
- la grille du joueur,
- les adversaires,
- les spectres,
- le lobby,
- les états de partie,
- les interactions utilisateur.

Il envoie les actions au serveur :
- déplacement,
- rotation,
- hard drop,
- soft drop,
- ready,
- join,
- restart.

### 2. Le serveur temps réel
Le serveur Node.js + Socket.IO :
- gère les rooms,
- valide les connexions,
- distribue les pièces,
- pilote l’état de partie,
- calcule les pénalités,
- décide du gagnant,
- diffuse les mises à jour.

Le serveur doit rester **autoritaire** sur la logique de partie.

### 3. La base de données
La base PostgreSQL sert à stocker les données persistantes :
- utilisateurs,
- parties terminées,
- scores,
- statistiques,
- classement.

Elle n’est pas utilisée pour chaque frame du jeu.

---

## 4. Pourquoi la base de données n’est pas au centre du gameplay

Le sujet précise qu’aucune persistance n’est nécessaire pour la partie obligatoire. :contentReference[oaicite:6]{index=6}

Nous avons tout de même choisi d’ajouter une base pour enrichir le projet avec :
- authentification,
- historique,
- classement,
- statistiques,
- sauvegarde des résultats.

Le choix d’architecture est donc le suivant :

### En mémoire serveur
- rooms actives,
- joueurs connectés,
- état courant du board,
- pièce active,
- séquence de pièces,
- pénalités,
- statut de manche.

### En base de données
- compte utilisateur,
- mot de passe hashé,
- parties terminées,
- score ou rang,
- historique personnel,
- données de leaderboard.

Cette séparation permet :
- de garder un gameplay rapide,
- d’éviter une dépendance inutile à la DB pendant la partie,
- d’avoir une architecture plus propre.

---

## 5. Structure du projet

```bash
red-tetris/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── store.ts
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── lobby/
│   │   │   ├── room/
│   │   │   ├── game/
│   │   │   └── leaderboard/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── api/
│   │   │   └── socket/
│   │   ├── styles/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── vite.config.ts
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── core/
│   │   │   ├── Game.ts
│   │   │   ├── Player.ts
│   │   │   ├── Piece.ts
│   │   │   └── Room.ts
│   │   ├── gateways/
│   │   │   └── socket/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── server.ts
│   └── package.json
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── tests/
│   ├── e2e/
│   └── integration/
│
├── .env
├── .env.example
├── package.json
└── README.md
