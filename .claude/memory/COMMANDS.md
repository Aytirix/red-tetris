---
name: Commands
description: Useful dev commands for Red Piece
type: project
---

# Commands — Red Piece

## Docker Compose (via Makefile)
```bash
make dev          # Start full dev stack (frontend HMR + backend + DB + pgadmin)
make dev-build    # Rebuild dev images
make dev-down     # Stop dev stack
make dev-logs     # Follow dev logs
make prod         # Start prod stack (Nginx)
make prod-build   # Rebuild prod images
make prod-down    # Stop prod stack
make down         # Stop all stacks (keep volumes)
make clean        # Stop all + remove volumes/networks
```

## Frontend (local)
```bash
cd frontend && npm run dev      # Vite dev server (port 5173 local, 5180 docker)
cd frontend && npm run build    # TypeScript check + Vite build
```

## Backend (local)
```bash
cd server && npm run dev        # tsx watch (hot reload)
cd server && npm run start      # tsx direct
```

## URLs
- Frontend dev: http://localhost:5180
- Frontend prod: http://localhost:8080
- WS Docs: http://localhost:5180/docs-ws
- pgAdmin: check docker-compose.yml for port
