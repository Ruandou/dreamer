-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- DropIndex
DROP INDEX "SceneDialogue_sceneId_idx";

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL DEFAULT '未命名剧本',
    "content" TEXT NOT NULL,
    "status" "ScriptStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scriptId" TEXT,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costCNY" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Script_userId_idx" ON "Script"("userId");

-- CreateIndex
CREATE INDEX "Script_status_idx" ON "Script"("status");

-- CreateIndex
CREATE INDEX "ChatConversation_userId_idx" ON "ChatConversation"("userId");

-- CreateIndex
CREATE INDEX "ChatConversation_scriptId_idx" ON "ChatConversation"("scriptId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryItem_projectId_episodeId_type_idx" ON "MemoryItem"("projectId", "episodeId", "type");

-- CreateIndex
CREATE INDEX "SceneDialogue_sceneId_startTimeMs_idx" ON "SceneDialogue"("sceneId", "startTimeMs");

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
