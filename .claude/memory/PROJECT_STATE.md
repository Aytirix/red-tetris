---
name: Project State
description: Current phase, done/remaining, known issues for Red Piece (red-tetris)
type: project
---

# Project State — Red Piece

**Phase**: Active development — Tetris game + multiplayer features

## Done
- Frontend scaffold: React 19 + TS + Vite + React Router
- Backend scaffold: Express 5 + Socket.io + Prisma + PostgreSQL
- Neon arcade theme: `styles.css` + `theme.css`, Orbitron font
- Dashboard page with parallax ship animations + room management
- WebSocket events: game, room, user domains
- WS docs page at `/docs-ws` backed by `server/ws-docs.json`
- Hand detection via webcam (MediaPipe) to control Tetris
- Test page with Tetris game logic
- Docker Compose: dev (hot reload) + prod (Nginx) profiles

## Remaining / In Progress
- Full multiplayer Tetris game loop (real-time sync between players)
- Game page (`GamePage.tsx`) — appears to exist but may be incomplete
- Backend game logic (handled by teammate — do not modify without agreement)

## Known Issues / Blockers
- Backend is managed by a separate teammate — frontend-only changes unless explicitly agreed
- No tests written yet (subject says testing required)

## Branch
- Current: `theo`
- Main: `main`
