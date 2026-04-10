# Préparation de l'image de base pour le développement et la production
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# L'image de développement
FROM base AS dev
ARG PORT_DEV_FRONTEND=5173
EXPOSE ${PORT_DEV_FRONTEND}

# L'image de production
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build