#!/bin/sh
set -e

# Le profil prod demarre sur une base potentiellement vierge: sans cette migration
# le schema n'existe pas et toute requete Prisma echoue en P2021 (TableDoesNotExist),
# ce qui rend le jeu injouable (aucun joueur ne peut s'enregistrer).
echo "Prisma migrate deploy..."
npx prisma migrate deploy

exec "$@"
