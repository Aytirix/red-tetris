-- AlterTable
ALTER TABLE "User" ADD COLUMN     "berrys" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "equippedTheme" TEXT NOT NULL DEFAULT 'neon-gem',
ADD COLUMN     "ownedThemes" TEXT[] DEFAULT ARRAY[]::TEXT[];
