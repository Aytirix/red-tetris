/*
  Warnings:

  - The `faction` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Faction" AS ENUM ('marine', 'pirate');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "faction",
ADD COLUMN     "faction" "Faction";
