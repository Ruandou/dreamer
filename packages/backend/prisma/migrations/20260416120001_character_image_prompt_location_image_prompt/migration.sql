-- AlterTable（须在 baseline 之后执行）
ALTER TABLE "CharacterImage" ADD COLUMN IF NOT EXISTS "prompt" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "imagePrompt" TEXT;
