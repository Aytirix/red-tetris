---
name: Architecture
description: Tech stack, project structure, key flows for Red Piece
type: project
---

# Architecture — Red Piece

## Stack
- **Frontend**: React 19 + TypeScript + Vite + React Router v7
  - Location: `frontend/`
  - Dev port: 5180 | Prod port: 8080 (Nginx)
- **Backend**: Express 5 + TypeScript + Socket.io + Prisma
  - Location: `server/`
  - DB: PostgreSQL
- **Infra**: Docker Compose (dev + prod profiles), Makefile

## Frontend Structure
```
frontend/src/
  components/       # Shared UI components
  contexts/         # SocketContext.tsx (Socket.io singleton wrapper)
  hooks/
  layouts/
  pages/            # DashboardPage, GamePage, HomePage, DocsWsPage, ThemePage
  socket/
    socket.ts       # Socket.io singleton
    events/         # game.ts, room.ts, user.ts (WS event definitions)
  styles.css        # Global arcade neon theme
  theme.css         # CSS variables (colors, fonts, shadows)
  types/
  router.tsx
  main.tsx
```

## Backend Structure
```
server/src/
  gateways/socket/
    handlers/       # WS event handlers
    emitters/       # WS emitters
    registerSocketHandlers.ts
    socketInit.ts
  routes/           # HTTP routes
  services/
  repositories/
  middlewares/
  config/
  server.ts
  app.ts
ws-docs.json        # WS event documentation (must stay in sync with frontend events)
```

## Key Rules
- Socket.io client = singleton in `frontend/src/socket/socket.ts`
- Every WS event added/modified in `frontend/src/socket/events/` → must update `server/ws-docs.json`
- Theme: use CSS classes from styles.css, CSS vars from theme.css — NO Tailwind for visual styles
- No Canvas, no SVG — layout via Grid/Flexbox only
- Backend: do NOT modify without explicit teammate agreement
