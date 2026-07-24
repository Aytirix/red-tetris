# Préparation de l'image de base pour le développement et la production
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
# --include=dev FORCE l'installation des devDependencies (vite, tsc…), même si le
# builder (ex. Coolify) injecte NODE_ENV=production au build : sans elles, `npm run
# build` échoue avec "vite: not found" (exit 127). Multi-stage : ces deps ne servent
# qu'à produire dist/, elles ne se retrouvent pas dans l'artefact final servi.
RUN npm ci --include=dev

# L'image de développement
FROM base AS dev
ARG PORT_DEV_FRONTEND=5173
EXPOSE ${PORT_DEV_FRONTEND}

# L'image de production
# VITE_PORT est fige au build: c'est le port sur lequel le client ouvrira le socket.
# En prod le serveur Express sert la SPA et le socket sur ce meme port (same-origin).
FROM base AS build
ARG VITE_PORT=3000
ENV VITE_PORT=$VITE_PORT
COPY . .
RUN npm run build