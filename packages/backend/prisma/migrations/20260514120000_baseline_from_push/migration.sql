-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('CHARACTER', 'LOCATION', 'EVENT', 'PLOT_POINT', 'FORESHADOWING', 'RELATIONSHIP', 'VISUAL_STYLE');

-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

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
    "modelPreferences" JSONB,
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
    "aspectRatio" TEXT,
    "userId" TEXT NOT NULL,
    "visualStyle" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visualStyleConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT,
    "targetEpisodes" INTEGER NOT NULL DEFAULT 40,
    "genreTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'outlining',

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeNum" INTEGER NOT NULL,
    "title" TEXT,
    "synopsis" TEXT,
    "content" TEXT,
    "script" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hook" TEXT,
    "cliffhanger" TEXT,
    "isPaywall" BOOLEAN NOT NULL DEFAULT false,
    "emotionCurve" JSONB,
    "conflictScore" INTEGER,
    "writeStatus" TEXT NOT NULL DEFAULT 'pending',

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
    "prompt" TEXT,
    "avatarUrl" TEXT,
    "imageCost" DOUBLE PRECISION,
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
    "imagePrompt" TEXT,
    "imageUrl" TEXT,
    "imageCost" DOUBLE PRECISION,
    "deletedAt" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL DEFAULT '未命名剧本',
    "content" TEXT NOT NULL,
    "status" "ScriptStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "targetEpisode" INTEGER,
    "generationStatus" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
CREATE TABLE "DramaTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "structure" JSONB NOT NULL,
    "exampleOutline" TEXT,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DramaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectOutline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT,
    "episodes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectOutline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HookTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HookTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeScore" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "hookStrength" INTEGER NOT NULL,
    "conflictDensity" INTEGER NOT NULL,
    "emotionVariance" INTEGER NOT NULL,
    "pacingScore" INTEGER NOT NULL,
    "paywallPotential" INTEGER NOT NULL,
    "suggestions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeScore_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "SceneDialogue_sceneId_startTimeMs_idx" ON "SceneDialogue"("sceneId", "startTimeMs");

-- CreateIndex
CREATE INDEX "SceneDialogue_characterId_idx" ON "SceneDialogue"("characterId");

-- CreateIndex
CREATE INDEX "Location_projectId_idx" ON "Location"("projectId");

-- CreateIndex
CREATE INDEX "Location_projectId_deletedAt_idx" ON "Location"("projectId", "deletedAt");

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

-- CreateIndex
CREATE INDEX "MemoryItem_projectId_type_idx" ON "MemoryItem"("projectId", "type");

-- CreateIndex
CREATE INDEX "MemoryItem_projectId_isActive_idx" ON "MemoryItem"("projectId", "isActive");

-- CreateIndex
CREATE INDEX "MemoryItem_projectId_importance_idx" ON "MemoryItem"("projectId", "importance");

-- CreateIndex
CREATE INDEX "MemoryItem_projectId_episodeId_type_idx" ON "MemoryItem"("projectId", "episodeId", "type");

-- CreateIndex
CREATE INDEX "MemoryItem_episodeId_idx" ON "MemoryItem"("episodeId");

-- CreateIndex
CREATE INDEX "MemorySnapshot_projectId_idx" ON "MemorySnapshot"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MemorySnapshot_projectId_upToEpisode_key" ON "MemorySnapshot"("projectId", "upToEpisode");

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
CREATE INDEX "ScriptMemoryItem_scriptId_type_idx" ON "ScriptMemoryItem"("scriptId", "type");

-- CreateIndex
CREATE INDEX "ScriptMemoryItem_scriptId_isActive_idx" ON "ScriptMemoryItem"("scriptId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectOutline_projectId_key" ON "ProjectOutline"("projectId");

-- CreateIndex
CREATE INDEX "HookTemplate_userId_idx" ON "HookTemplate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeScore_episodeId_key" ON "EpisodeScore"("episodeId");

-- CreateIndex
CREATE INDEX "AgentCheckpoint_scriptId_idx" ON "AgentCheckpoint"("scriptId");

-- CreateIndex
CREATE INDEX "AgentCheckpoint_agentType_idx" ON "AgentCheckpoint"("agentType");

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

-- AddForeignKey
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorySnapshot" ADD CONSTRAINT "MemorySnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptMemoryItem" ADD CONSTRAINT "ScriptMemoryItem_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOutline" ADD CONSTRAINT "ProjectOutline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeScore" ADD CONSTRAINT "EpisodeScore_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

