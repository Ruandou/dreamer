-- 与当前 schema.prisma 对齐的 schema 扩展（单条迁移；旧拆分迁移见 AGENTS.md）。

-- Project / Episode 梗概
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "synopsis" TEXT;
ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "synopsis" TEXT;

-- Character 语音
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "voiceId" TEXT;
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "voiceConfig" JSONB;

-- Location 参考图
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- Composition 归属 Episode
ALTER TABLE "Composition" ADD COLUMN IF NOT EXISTS "episodeId" TEXT;

UPDATE "Composition" c
SET "episodeId" = (
  SELECT e.id
  FROM "Episode" e
  WHERE e."projectId" = c."projectId"
  ORDER BY e."episodeNum" ASC NULLS LAST
  LIMIT 1
)
WHERE c."episodeId" IS NULL;

DELETE FROM "Composition" WHERE "episodeId" IS NULL;

ALTER TABLE "Composition" ALTER COLUMN "episodeId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Composition_episodeId_idx" ON "Composition"("episodeId");

ALTER TABLE "Composition" DROP CONSTRAINT IF EXISTS "Composition_episodeId_fkey";

ALTER TABLE "Composition"
  ADD CONSTRAINT "Composition_episodeId_fkey"
  FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
