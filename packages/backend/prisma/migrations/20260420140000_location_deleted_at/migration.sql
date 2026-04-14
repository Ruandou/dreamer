-- Location 软删除与列表过滤（schema 中 deletedAt + 复合索引）
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Location_projectId_deletedAt_idx" ON "Location"("projectId", "deletedAt");
