-- 列名与 Prisma 字段一致为 aspectRatio；若曾用迁移加过 defaultAspectRatio 则改名，否则直接补列
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'defaultAspectRatio'
  ) THEN
    ALTER TABLE "Project" RENAME COLUMN "defaultAspectRatio" TO "aspectRatio";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'aspectRatio'
  ) THEN
    ALTER TABLE "Project" ADD COLUMN "aspectRatio" TEXT;
  END IF;
END $$;
