#!/bin/sh
set -e

echo "Prisma generate..."
npx prisma generate

echo "Prisma migrate dev..."
npx prisma migrate dev --name init

exec "$@"
