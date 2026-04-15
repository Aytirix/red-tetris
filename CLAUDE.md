# Red Piece — Instructions Claude

## Thème frontend

Toutes les pages et composants frontend **doivent** utiliser le thème arcade neon défini dans `frontend/src/styles.css` et `frontend/src/theme.css`.

### Règles obligatoires
- Utiliser les classes CSS existantes : `.card`, `.button`, `.button-primary`, `.button-secondary`, `.button-ghost`, `.button-outline`, `.eyebrow`, `.section-kicker`, `.badge`, `.mini-card`, `.micro-card`, `.hero-card`, `.split-grid`, `.feature-grid`, etc.
- Utiliser les variables CSS du thème : `var(--color-primary)`, `var(--color-secondary)`, `var(--color-accent)`, `var(--color-bg-0)`, `var(--color-text)`, `var(--color-text-muted)`, `var(--color-border)`, `var(--shadow-neon-red)`, `var(--shadow-neon-cyan)`, etc.
- Les titres (`h1`, `h2`, `h3`) utilisent automatiquement la font **Orbitron** (`var(--font-display)`)
- Le fond est sombre (`#050816`) — ne jamais utiliser de fonds blancs ou clairs
- **Ne pas utiliser de classes Tailwind utilitaires** pour le style visuel — uniquement pour la mise en page si nécessaire

### Palette
| Rôle | Variable | Valeur |
|------|----------|--------|
| Primaire (rouge) | `--color-primary` | `#ff365f` |
| Secondaire (cyan) | `--color-secondary` | `#3de7ff` |
| Accent (violet) | `--color-accent` | `#9069ff` |
| Fond principal | `--color-bg-0` | `#050816` |
| Texte | `--color-text` | `#f4f7ff` |
| Texte atténué | `--color-text-muted` | `#aeb8d3` |

## Structure du projet

- **Frontend** : React 19 + TypeScript + Vite — `frontend/`
- **Backend** : Express 5 + TypeScript + Socket.io — `server/`
- **Socket.io client** : singleton dans `frontend/src/socket/socket.ts`, contexte dans `frontend/src/contexts/SocketContext.tsx`
- **Events WS** : déclarés dans `frontend/src/socket/events/` (un fichier par domaine)
- **Doc WS** : page `/docs-ws`, données dans `server/ws-docs.json`

## Events WebSocket — règle obligatoire

**À chaque ajout ou modification d'un event WS côté frontend** (dans `frontend/src/socket/events/`), il faut **impérativement** mettre à jour `server/ws-docs.json` pour que la doc `/docs-ws` reste à jour.

Format d'une entrée dans `ws-docs.json` :
```json
{
  "id": "<uuid>",
  "name": "domaine:NomEvent",
  "direction": "front-to-back" | "back-to-front",
  "group": "domaine",
  "description": "",
  "payload": "{ ... }",
  "payloadDescription": "",
  "response": "{ ... }",
  "responseName": "domaine:NomReponse",
  "responseDescription": ""
}
```

## Backend

- Ne pas modifier le backend sans accord explicite — c'est géré par une autre personne de l'équipe
