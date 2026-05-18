-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "ChatConversation_projectId_idx" ON "ChatConversation"("projectId");

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

