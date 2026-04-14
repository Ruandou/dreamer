-- baseline 未含项目画幅列；先以 defaultAspectRatio 落列，避免改动已应用迁移的 checksum
-- 列名在 20260420150000_project_aspect_ratio_rename 中统一为 aspectRatio
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "defaultAspectRatio" TEXT;
