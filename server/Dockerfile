FROM node:24-trixie-slim as dev

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

COPY docker/entrypoint.dev.sh /usr/local/bin/entrypoint.dev.sh
RUN chmod +x /usr/local/bin/entrypoint.dev.sh

EXPOSE 3000

ENTRYPOINT ["entrypoint.dev.sh"]
CMD ["npm", "run", "dev"]