-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totalGames" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalLines" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalTetris" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bestScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "playtimeMs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FactionStats" ADD COLUMN     "tetris" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lines" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bestScore" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GameRecord" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "faction" "Faction",
    "mode" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "lines" INTEGER NOT NULL,
    "tetris" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "won" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameRecord_username_idx" ON "GameRecord"("username");

-- CreateIndex
CREATE INDEX "GameRecord_faction_idx" ON "GameRecord"("faction");

-- CreateIndex
CREATE INDEX "GameRecord_mode_idx" ON "GameRecord"("mode");

-- CreateIndex
CREATE INDEX "GameRecord_score_idx" ON "GameRecord"("score");
