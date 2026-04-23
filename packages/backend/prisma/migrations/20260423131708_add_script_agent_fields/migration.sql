-- AlterTable
ALTER TABLE "Script" ADD COLUMN     "generationStatus" JSONB,
ADD COLUMN     "targetEpisode" INTEGER;

-- CreateTable
CREATE TABLE "ScriptMemoryItem" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importance" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptMemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCheckpoint" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScriptMemoryItem_scriptId_type_idx" ON "ScriptMemoryItem"("scriptId", "type");

-- CreateIndex
CREATE INDEX "ScriptMemoryItem_scriptId_isActive_idx" ON "ScriptMemoryItem"("scriptId", "isActive");

-- CreateIndex
CREATE INDEX "AgentCheckpoint_scriptId_idx" ON "AgentCheckpoint"("scriptId");

-- CreateIndex
CREATE INDEX "AgentCheckpoint_agentType_idx" ON "AgentCheckpoint"("agentType");

-- AddForeignKey
ALTER TABLE "ScriptMemoryItem" ADD CONSTRAINT "ScriptMemoryItem_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;
