---
name: Decisions
description: Key conventions and architectural decisions for Red Piece
type: project
---

# Decisions — Red Piece

## Theme
- Arcade neon theme is mandatory for ALL frontend pages/components
- CSS classes: `.card`, `.button`, `.button-primary`, `.badge`, `.mini-card`, etc.
- CSS vars: `--color-primary` (#ff365f red), `--color-secondary` (#3de7ff cyan), `--color-accent` (#9069ff violet)
- Background always dark `#050816` — never white or light
- Headings use Orbitron font automatically via `var(--font-display)`
- No Tailwind utility classes for visual styling (only layout if needed)

## WebSocket
- Events grouped by domain: game, room, user
- Each domain has its own file in `frontend/src/socket/events/`
- ws-docs.json must be updated whenever events change (keeps `/docs-ws` in sync)
- WS UUID format required for each event entry

## Team Split
- Frontend: theo (this user)
- Backend: separate teammate — modifications require explicit agreement
- This means: frontend changes freely, backend changes only when agreed

## Project Constraints (from subject)
- No Canvas, no SVG
- Layout via CSS Grid/Flexbox only
- Full JS/TS stack
- SPA client
- Socket.io for real-time communication
