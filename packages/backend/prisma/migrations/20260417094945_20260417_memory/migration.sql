-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('CHARACTER', 'LOCATION', 'EVENT', 'PLOT_POINT', 'FORESHADOWING', 'RELATIONSHIP', 'VISUAL_STYLE');

-- CreateTable
CREATE TABLE "MemoryItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "relatedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "episodeId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importance" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorySnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upToEpisode" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "contextJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryItem_projectId_type_idx" ON "MemoryItem"("projectId", "type");

-- CreateIndex
CREATE INDEX "MemoryItem_projectId_isActive_idx" ON "MemoryItem"("projectId", "isActive");

-- CreateIndex
CREATE INDEX "MemoryItem_projectId_importance_idx" ON "MemoryItem"("projectId", "importance");

-- CreateIndex
CREATE INDEX "MemoryItem_episodeId_idx" ON "MemoryItem"("episodeId");

-- CreateIndex
CREATE INDEX "MemorySnapshot_projectId_idx" ON "MemorySnapshot"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MemorySnapshot_projectId_upToEpisode_key" ON "MemorySnapshot"("projectId", "upToEpisode");

-- AddForeignKey
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorySnapshot" ADD CONSTRAINT "MemorySnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
