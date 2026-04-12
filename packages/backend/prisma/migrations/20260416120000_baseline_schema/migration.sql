-- Dreamer baseline (PostgreSQL): full schema aligned with prisma/schema.prisma.
-- OutlineJob 已废弃：若旧库仍存在该表则先删除，再创建当前模型（新库上为 no-op）。
DROP TABLE IF EXISTS "OutlineJob";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "apiKey" TEXT,
    "deepseekApiUrl" TEXT,
    "atlasApiKey" TEXT,
    "atlasApiUrl" TEXT,
    "arkApiKey" TEXT,
    "arkApiUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "synopsis" TEXT,
    "storyContext" TEXT,
    "userId" TEXT NOT NULL,
    "visualStyle" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeNum" INTEGER NOT NULL,
    "title" TEXT,
    "synopsis" TEXT,
    "script" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "voiceId" TEXT,
    "voiceConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterImage" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "parentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'base',
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneNum" INTEGER NOT NULL,
    "locationId" TEXT,
    "timeOfDay" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "duration" INTEGER NOT NULL DEFAULT 0,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "visualStyle" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seedanceParams" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shotNum" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "cameraMovement" TEXT,
    "cameraAngle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterShot" (
    "id" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "characterImageId" TEXT NOT NULL,
    "action" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterShot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneDialogue" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startTimeMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "voiceConfig" JSONB NOT NULL,
    "emotion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneDialogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "timeOfDay" TEXT,
    "characters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Take" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "externalTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "prompt" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "duration" INTEGER,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "errorMsg" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Take_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelApiCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "requestParams" TEXT,
    "externalTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "responseData" TEXT,
    "cost" DOUBLE PRECISION,
    "duration" INTEGER,
    "errorMsg" TEXT,
    "takeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelApiCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Composition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "outputUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Composition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionScene" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "takeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CompositionScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'markdown',
    "result" JSONB,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "jobType" TEXT NOT NULL DEFAULT 'full-pipeline',
    "currentStep" TEXT NOT NULL DEFAULT 'script-writing',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressMeta" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStepResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStepResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "mood" TEXT[],
    "location" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Episode_projectId_idx" ON "Episode"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_projectId_episodeNum_key" ON "Episode"("projectId", "episodeNum");

-- CreateIndex
CREATE INDEX "Character_projectId_idx" ON "Character"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_projectId_name_key" ON "Character"("projectId", "name");

-- CreateIndex
CREATE INDEX "CharacterImage_characterId_idx" ON "CharacterImage"("characterId");

-- CreateIndex
CREATE INDEX "CharacterImage_parentId_idx" ON "CharacterImage"("parentId");

-- CreateIndex
CREATE INDEX "Scene_episodeId_idx" ON "Scene"("episodeId");

-- CreateIndex
CREATE INDEX "Scene_locationId_idx" ON "Scene"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_episodeId_sceneNum_key" ON "Scene"("episodeId", "sceneNum");

-- CreateIndex
CREATE INDEX "Shot_sceneId_idx" ON "Shot"("sceneId");

-- CreateIndex
CREATE INDEX "CharacterShot_shotId_idx" ON "CharacterShot"("shotId");

-- CreateIndex
CREATE INDEX "CharacterShot_characterImageId_idx" ON "CharacterShot"("characterImageId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterShot_shotId_characterImageId_key" ON "CharacterShot"("shotId", "characterImageId");

-- CreateIndex
CREATE INDEX "SceneDialogue_sceneId_idx" ON "SceneDialogue"("sceneId");

-- CreateIndex
CREATE INDEX "SceneDialogue_characterId_idx" ON "SceneDialogue"("characterId");

-- CreateIndex
CREATE INDEX "Location_projectId_idx" ON "Location"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_projectId_location_key" ON "Location"("projectId", "location");

-- CreateIndex
CREATE INDEX "Take_sceneId_idx" ON "Take"("sceneId");

-- CreateIndex
CREATE INDEX "Take_externalTaskId_idx" ON "Take"("externalTaskId");

-- CreateIndex
CREATE INDEX "ModelApiCall_userId_idx" ON "ModelApiCall"("userId");

-- CreateIndex
CREATE INDEX "ModelApiCall_externalTaskId_idx" ON "ModelApiCall"("externalTaskId");

-- CreateIndex
CREATE INDEX "ModelApiCall_model_idx" ON "ModelApiCall"("model");

-- CreateIndex
CREATE INDEX "ModelApiCall_createdAt_idx" ON "ModelApiCall"("createdAt");

-- CreateIndex
CREATE INDEX "Composition_projectId_idx" ON "Composition"("projectId");

-- CreateIndex
CREATE INDEX "Composition_episodeId_idx" ON "Composition"("episodeId");

-- CreateIndex
CREATE INDEX "CompositionScene_compositionId_idx" ON "CompositionScene"("compositionId");

-- CreateIndex
CREATE INDEX "CompositionScene_sceneId_idx" ON "CompositionScene"("sceneId");

-- CreateIndex
CREATE INDEX "CompositionScene_takeId_idx" ON "CompositionScene"("takeId");

-- CreateIndex
CREATE INDEX "ImportTask_userId_idx" ON "ImportTask"("userId");

-- CreateIndex
CREATE INDEX "PipelineJob_projectId_idx" ON "PipelineJob"("projectId");

-- CreateIndex
CREATE INDEX "PipelineStepResult_jobId_idx" ON "PipelineStepResult"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStepResult_jobId_step_key" ON "PipelineStepResult"("jobId", "step");

-- CreateIndex
CREATE INDEX "ProjectAsset_projectId_idx" ON "ProjectAsset"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterImage" ADD CONSTRAINT "CharacterImage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterImage" ADD CONSTRAINT "CharacterImage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CharacterImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterShot" ADD CONSTRAINT "CharacterShot_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "Shot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterShot" ADD CONSTRAINT "CharacterShot_characterImageId_fkey" FOREIGN KEY ("characterImageId") REFERENCES "CharacterImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneDialogue" ADD CONSTRAINT "SceneDialogue_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneDialogue" ADD CONSTRAINT "SceneDialogue_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Take" ADD CONSTRAINT "Take_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelApiCall" ADD CONSTRAINT "ModelApiCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelApiCall" ADD CONSTRAINT "ModelApiCall_takeId_fkey" FOREIGN KEY ("takeId") REFERENCES "Take"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionScene" ADD CONSTRAINT "CompositionScene_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "Composition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionScene" ADD CONSTRAINT "CompositionScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionScene" ADD CONSTRAINT "CompositionScene_takeId_fkey" FOREIGN KEY ("takeId") REFERENCES "Take"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportTask" ADD CONSTRAINT "ImportTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineJob" ADD CONSTRAINT "PipelineJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStepResult" ADD CONSTRAINT "PipelineStepResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PipelineJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
