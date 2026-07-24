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

# Image de production: compile le TypeScript et sert la SPA + le socket depuis Node.
FROM node:24-trixie-slim AS prod

WORKDIR /app

COPY package*.json ./
# --include=dev FORCE les devDependencies (typescript…) même si le builder injecte
# NODE_ENV=production : `npm run build` (tsc) échouerait sinon avec "tsc: not found".
RUN npm install --include=dev

COPY . .
RUN npx prisma generate && npm run build

COPY docker/entrypoint.prod.sh /usr/local/bin/entrypoint.prod.sh
RUN chmod +x /usr/local/bin/entrypoint.prod.sh

EXPOSE 3000

ENTRYPOINT ["entrypoint.prod.sh"]
CMD ["node", "dist/server.js"]