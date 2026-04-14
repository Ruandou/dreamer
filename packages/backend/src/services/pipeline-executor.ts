/**
 * Pipeline 执行器 - 异步 Job 模式
 * 负责在后台执行 Pipeline 各步骤并更新 Job 状态
 */

import { prisma } from '../index.js'
import {
  writeScriptFromIdea
} from './script-writer.js'

import {
  splitIntoEpisodes
} from './episode-splitter.js'

import {
  extractActionsFromScenes
} from './action-extractor.js'

import {
  matchAssetsForScenes,
  convertCharacterImagesToAssets,
  type ProjectAsset
} from './scene-asset.js'

import {
  generateStoryboard
} from './storyboard-generator.js'

import {
  mergeEpisodesToScriptContent,
  areEpisodeScriptsComplete,
  buildEpisodePlansFromDbEpisodes,
  DEFAULT_TARGET_EPISODES
} from './project-script-jobs.js'
import { saveCharacters, saveLocations } from './script-entities.js'

import type {
  ScriptContent,
  ScriptScene,
  EpisodePlan,
  SceneActions,
  SceneAssetRecommendation,
  StoryboardSegment
} from '@dreamer/shared/types'

interface PipelineJobOptions {
  projectId: string
  idea: string
  targetEpisodes?: number
  targetDuration?: number
  defaultAspectRatio: '16:9' | '9:16' | '1:1'
  defaultResolution: '480p' | '720p'
}

/**
 * 更新 Job 进度
 */
async function updateJobProgress(jobId: string, update: {
  status?: string
  currentStep?: string
  progress?: number
  error?: string
}) {
  await prisma.pipelineJob.update({
    where: { id: jobId },
    data: update
  })
}

/**
 * 更新步骤结果
 */
async function updateStepResult(jobId: string, step: string, update: {
  status?: string
  input?: any
  output?: any
  error?: string
}) {
  await prisma.pipelineStepResult.updateMany({
    where: { jobId, step },
    data: {
      ...update,
      updatedAt: new Date()
    }
  })
}

/**
 * 保存分集到数据库
 */
async function saveEpisodes(projectId: string, episodes: EpisodePlan[], rawScript: ScriptContent) {
  for (const episode of episodes) {
    await prisma.episode.upsert({
      where: {
        projectId_episodeNum: { projectId, episodeNum: episode.episodeNum }
      },
      update: {
        title: episode.title,
        synopsis: episode.synopsis,
        rawScript: rawScript as object
      },
      create: {
        projectId,
        episodeNum: episode.episodeNum,
        title: episode.title,
        synopsis: episode.synopsis,
        rawScript: rawScript as object
      }
    })
  }
}

/**
 * 保存分场 / 镜头 / 台词到数据库（v4.1：Scene + Shot + SceneDialogue + CharacterShot）
 */
async function saveSegments(
  projectId: string,
  episodes: EpisodePlan[],
  storyboard: StoryboardSegment[],
  scriptScenes: ScriptScene[]
) {
  for (const segment of storyboard) {
    const episode = episodes.find(e => e.episodeNum === segment.episodeNum)
    if (!episode) continue

    const episodeRecord = await prisma.episode.findFirst({
      where: { projectId, episodeNum: segment.episodeNum }
    })
    if (!episodeRecord) continue

    let locationId: string | undefined
    if (segment.location) {
      const location = await prisma.location.findFirst({
        where: { projectId, name: segment.location, deletedAt: null }
      })
      locationId = location?.id
    }

    const sceneRecord = await prisma.scene.upsert({
      where: {
        episodeId_sceneNum: {
          episodeId: episodeRecord.id,
          sceneNum: segment.segmentNum
        }
      },
      update: {
        locationId,
        duration: segment.duration,
        aspectRatio: segment.aspectRatio,
        visualStyle: segment.visualStyle || [],
        description: segment.description,
        timeOfDay: segment.timeOfDay,
        status: 'pending'
      },
      create: {
        episodeId: episodeRecord.id,
        sceneNum: segment.segmentNum,
        locationId,
        duration: segment.duration,
        aspectRatio: segment.aspectRatio,
        visualStyle: segment.visualStyle || [],
        description: segment.description,
        timeOfDay: segment.timeOfDay,
        status: 'pending'
      }
    })

    await prisma.shot.deleteMany({ where: { sceneId: sceneRecord.id } })
    await prisma.sceneDialogue.deleteMany({ where: { sceneId: sceneRecord.id } })

    if (segment.subShots && segment.subShots.length > 0) {
      for (const subShot of segment.subShots) {
        await prisma.shot.create({
          data: {
            sceneId: sceneRecord.id,
            shotNum: subShot.order,
            order: subShot.order,
            description: subShot.description,
            duration: subShot.durationMs,
            cameraMovement: segment.cameraMovement
          }
        })
      }
    } else {
      await prisma.shot.create({
        data: {
          sceneId: sceneRecord.id,
          shotNum: 1,
          order: 1,
          description: segment.seedancePrompt,
          duration: segment.duration,
          cameraMovement: segment.cameraMovement
        }
      })
    }

    const firstShot = await prisma.shot.findFirst({
      where: { sceneId: sceneRecord.id },
      orderBy: [{ order: 'asc' }, { shotNum: 'asc' }]
    })

    if (segment.characterActions && firstShot) {
      for (const [characterName, action] of Object.entries(segment.characterActions)) {
        const character = await prisma.character.findFirst({
          where: { projectId, name: characterName }
        })
        if (!character) continue

        const characterImage = await prisma.characterImage.findFirst({
          where: { characterId: character.id, type: 'base' }
        })
        if (!characterImage) continue

        await prisma.characterShot.upsert({
          where: {
            shotId_characterImageId: {
              shotId: firstShot.id,
              characterImageId: characterImage.id
            }
          },
          update: { action },
          create: {
            shotId: firstShot.id,
            characterImageId: characterImage.id,
            action
          }
        })
      }
    }

    if (segment.voiceSegments && segment.voiceSegments.length > 0) {
      const sceneIndex = episode.sceneIndices
        ? episode.sceneIndices[segment.segmentNum - 1]
        : segment.segmentNum - 1
      const scriptScene = scriptScenes[sceneIndex]

      for (const voice of segment.voiceSegments) {
        let characterId = voice.characterId

        if (!characterId && scriptScene) {
          const characterName = scriptScene.dialogues[voice.order - 1]?.character
          if (characterName) {
            const character = await prisma.character.findFirst({
              where: { projectId, name: characterName }
            })
            if (character) {
              characterId = character.id
            }
          }
        }

        if (!characterId && segment.characters && scriptScene) {
          const dialogue = scriptScene.dialogues[voice.order - 1]
          if (dialogue) {
            const characterInSegment = segment.characters.find(
              c => c.name === dialogue.character
            )
            if (characterInSegment) {
              const character = await prisma.character.findFirst({
                where: { projectId, name: dialogue.character }
              })
              if (character) {
                characterId = character.id
              }
            }
          }
        }

        if (!characterId) {
          console.warn(`SceneDialogue skipped: no character for scene ${sceneRecord.id}, order ${voice.order}`)
          continue
        }

        await prisma.sceneDialogue.create({
          data: {
            sceneId: sceneRecord.id,
            characterId,
            order: voice.order,
            startTimeMs: voice.startTimeMs,
            durationMs: voice.durationMs,
            text: voice.text,
            voiceConfig: JSON.parse(JSON.stringify(voice.voiceConfig)) as object,
            emotion: voice.emotion
          }
        })
      }
    }
  }
}

/**
 * 执行 Pipeline Job
 */
export async function executePipelineJob(jobId: string, options: PipelineJobOptions) {
  const { projectId, idea, targetEpisodes, targetDuration, defaultAspectRatio, defaultResolution } = options

  console.log(`Starting Pipeline Job ${jobId} for project ${projectId}`)

  try {
    // 更新状态为运行中
    await updateJobProgress(jobId, { status: 'running', currentStep: 'script-writing', progress: 5 })

    const te = targetEpisodes && targetEpisodes > 0 ? targetEpisodes : DEFAULT_TARGET_EPISODES
    const existingEpisodes = await prisma.episode.findMany({
      where: { projectId, episodeNum: { lte: te } },
      orderBy: { episodeNum: 'asc' }
    })
    const skipEarlySteps =
      existingEpisodes.length >= te && areEpisodeScriptsComplete(existingEpisodes, te)

    let script: ScriptContent
    let episodes: EpisodePlan[]

    if (skipEarlySteps) {
      // ========== 已具备全部分集 rawScript：跳过 AI 写剧与智能分集 ==========
      await updateStepResult(jobId, 'script-writing', {
        status: 'completed',
        input: { idea },
        output: { skipped: true, reason: 'episodes_already_have_rawScript' }
      })
      await updateJobProgress(jobId, { progress: 25 })

      script = mergeEpisodesToScriptContent(existingEpisodes)
      await saveCharacters(projectId, script)
      await saveLocations(projectId, script)

      await updateStepProgress(jobId, 'episode-split', 'processing')
      episodes = buildEpisodePlansFromDbEpisodes(existingEpisodes, script)
      await updateStepResult(jobId, 'episode-split', {
        status: 'completed',
        output: { episodes, skipped: true }
      })
      await updateJobProgress(jobId, { currentStep: 'episode-split', progress: 45 })
    } else {
      // ========== 步骤 1: 剧本生成 ==========
      await updateStepResult(jobId, 'script-writing', { status: 'processing', input: { idea } })

      const scriptResult = await writeScriptFromIdea(idea, {
        characters: [] // TODO: 传入已有角色
      })

      script = scriptResult.script
      await updateStepResult(jobId, 'script-writing', {
        status: 'completed',
        output: { script }
      })
      await updateJobProgress(jobId, { progress: 25 })

      // 保存角色和场地
      await saveCharacters(projectId, script)
      await saveLocations(projectId, script)

      // ========== 步骤 2: 智能分集 ==========
      await updateStepProgress(jobId, 'episode-split', 'processing')

      episodes = splitIntoEpisodes(script, {
        targetDuration: targetDuration || 60
      })

      await saveEpisodes(projectId, episodes, script)
      await updateStepResult(jobId, 'episode-split', {
        status: 'completed',
        output: { episodes }
      })
      await updateJobProgress(jobId, { currentStep: 'episode-split', progress: 45 })
    }

    // ========== 步骤 3: 分镜提取 ==========
    await updateStepResult(jobId, 'segment-extract', { status: 'processing' })

    const sceneActions = extractActionsFromScenes(script.scenes, [])
    await updateStepResult(jobId, 'segment-extract', {
      status: 'completed',
      output: { sceneActions }
    })
    await updateJobProgress(jobId, { currentStep: 'segment-extract', progress: 65 })

    // ========== 步骤 4: 分镜生成 ==========
    await updateStepResult(jobId, 'storyboard', { status: 'processing' })

    // 获取项目角色和场地
    const characters = await prisma.character.findMany({
      where: { projectId },
      include: { images: true }
    })

    const locations = await prisma.location.findMany({
      where: { projectId, deletedAt: null }
    })

    // 转换素材
    const projectAssets: ProjectAsset[] = []
    const characterImages = characters.flatMap(c => c.images)

    // 生成 storyboard
    const allSegments: StoryboardSegment[] = []
    for (const episode of episodes) {
      const segments = generateStoryboard(
        episode,
        script.scenes,
        [], // assetRecommendations
        { defaultAspectRatio }
      )
      allSegments.push(...segments)
    }

    // 保存分镜到数据库
    await saveSegments(projectId, episodes, allSegments, script.scenes)

    await updateStepResult(jobId, 'storyboard', {
      status: 'completed',
      output: { storyboard: allSegments }
    })
    await updateJobProgress(jobId, { currentStep: 'storyboard', progress: 90 })

    // ========== 完成 ==========
    await updateJobProgress(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'completed'
    })

    console.log(`Pipeline Job ${jobId} completed successfully`)

  } catch (error) {
    console.error(`Pipeline Job ${jobId} failed:`, error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await updateJobProgress(jobId, {
      status: 'failed',
      error: errorMessage
    })

    // 更新当前步骤为失败
    await updateStepResult(jobId, 'unknown', {
      status: 'failed',
      error: errorMessage
    })
  }
}

async function updateStepProgress(jobId: string, step: string, status: string) {
  await updateStepResult(jobId, step, { status })
}
