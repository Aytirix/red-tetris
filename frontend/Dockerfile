# Préparation de l'image de base pour le développement et la production
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# L'image de développement
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 5173

# L'image de production
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# L'image finale pour la production exécutant Nginx pour servir les fichiers statiques
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
