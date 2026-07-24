FROM node:24-trixie-slim as dev

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev

COPY . .

COPY docker/entrypoint.dev.sh /usr/local/bin/entrypoint.dev.sh
RUN chmod +x /usr/local/bin/entrypoint.dev.sh

EXPOSE 3000

ENTRYPOINT ["entrypoint.dev.sh"]
CMD ["npm", "run", "dev"]

# NB : l'image de PRODUCTION n'est plus ici. Elle est construite par /Dockerfile.prod
# (contexte = racine du dépôt) qui embarque la SPA dans l'image backend — un seul
# service long-running, compatible avec la policy restart de Coolify.