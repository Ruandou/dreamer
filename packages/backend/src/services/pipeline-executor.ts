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

import type {
  ScriptContent,
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
 * 保存角色到数据库
 */
async function saveCharacters(projectId: string, script: ScriptContent) {
  const characterNames = new Set<string>()

  for (const scene of script.scenes) {
    for (const character of scene.characters || []) {
      characterNames.add(character)
    }
  }

  for (const name of characterNames) {
    await prisma.character.upsert({
      where: {
        projectId_name: { projectId, name }
      },
      update: {},
      create: {
        projectId,
        name,
        description: `角色: ${name}`
      }
    })
  }
}

/**
 * 保存场地到数据库
 */
async function saveLocations(projectId: string, script: ScriptContent) {
  const locationMap = new Map<string, { timeOfDay?: string; description?: string }>()

  for (const scene of script.scenes) {
    if (scene.location) {
      if (!locationMap.has(scene.location)) {
        locationMap.set(scene.location, {
          timeOfDay: scene.timeOfDay,
          description: scene.description
        })
      }
    }
  }

  for (const [location, info] of locationMap) {
    await prisma.location.upsert({
      where: {
        projectId_location: { projectId, location }
      },
      update: { timeOfDay: info.timeOfDay, description: info.description },
      create: {
        projectId,
        location,
        timeOfDay: info.timeOfDay || '日',
        description: info.description
      }
    })
  }
}

/**
 * 保存分集到数据库
 */
async function saveEpisodes(projectId: string, episodes: EpisodePlan[]) {
  for (const episode of episodes) {
    await prisma.episode.upsert({
      where: {
        projectId_episodeNum: { projectId, episodeNum: episode.episodeNum }
      },
      update: {
        title: episode.title,
        synopsis: episode.synopsis,
        sceneIndices: episode.sceneIndices
      },
      create: {
        projectId,
        episodeNum: episode.episodeNum,
        title: episode.title,
        synopsis: episode.synopsis,
        sceneIndices: episode.sceneIndices
      }
    })
  }
}

/**
 * 保存分镜到数据库
 */
async function saveSegments(
  projectId: string,
  episodes: EpisodePlan[],
  storyboard: StoryboardSegment[],
  scenes: ScriptScene[]
) {
  for (const segment of storyboard) {
    const episode = episodes.find(e => e.episodeNum === segment.episodeNum)
    if (!episode) continue

    // 获取 episode
    const episodeRecord = await prisma.episode.findFirst({
      where: { projectId, episodeNum: segment.episodeNum }
    })
    if (!episodeRecord) continue

    // 获取 location
    let locationId: string | undefined
    if (segment.location) {
      const location = await prisma.location.findFirst({
        where: { projectId, location: segment.location }
      })
      locationId = location?.id
    }

    // 创建/更新 Segment
    const segmentRecord = await prisma.segment.upsert({
      where: {
        episodeId_segmentNum: {
          episodeId: episodeRecord.id,
          segmentNum: segment.segmentNum
        }
      },
      update: {
        locationId,
        duration: segment.duration,
        cameraMovement: segment.cameraMovement,
        aspectRatio: segment.aspectRatio,
        prompt: segment.seedancePrompt,
        visualStyle: segment.visualStyle || [],
        status: 'pending'
      },
      create: {
        episodeId: episodeRecord.id,
        segmentNum: segment.segmentNum,
        locationId,
        duration: segment.duration,
        cameraMovement: segment.cameraMovement,
        aspectRatio: segment.aspectRatio,
        prompt: segment.seedancePrompt,
        visualStyle: segment.visualStyle || [],
        status: 'pending'
      }
    })

    // 保存 SubShots
    if (segment.subShots) {
      for (const subShot of segment.subShots) {
        await prisma.subShot.upsert({
          where: {
            id: subShot.id || `temp-${segmentRecord.id}-${subShot.order}`
          },
          update: {
            order: subShot.order,
            durationMs: subShot.durationMs,
            description: subShot.description
          },
          create: {
            segmentId: segmentRecord.id,
            order: subShot.order,
            durationMs: subShot.durationMs,
            description: subShot.description
          }
        })
      }
    }

    // 保存 CharacterSegments
    if (segment.characterActions) {
      for (const [characterName, action] of Object.entries(segment.characterActions)) {
        // 查找角色
        const character = await prisma.character.findFirst({
          where: { projectId, name: characterName }
        })
        if (!character) continue

        // 查找角色的基础形象
        const characterImage = await prisma.characterImage.findFirst({
          where: { characterId: character.id, type: 'base' }
        })
        if (!characterImage) continue

        await prisma.characterSegment.upsert({
          where: {
            segmentId_characterImageId: {
              segmentId: segmentRecord.id,
              characterImageId: characterImage.id
            }
          },
          update: { action },
          create: {
            segmentId: segmentRecord.id,
            characterImageId: characterImage.id,
            action
          }
        })
      }
    }

    // 保存 VoiceSegments
    if (segment.voiceSegments && segment.voiceSegments.length > 0) {
      // 通过 segmentNum 找到对应的 scene（segmentNum 是从 1 开始的索引）
      const sceneIndex = episode.sceneIndices
        ? episode.sceneIndices[segment.segmentNum - 1]
        : segment.segmentNum - 1
      const scene = scenes[sceneIndex]

      for (const voice of segment.voiceSegments) {
        let characterId = voice.characterId

        // 如果 characterId 为空，通过角色名查找
        if (!characterId && scene) {
          const characterName = scene.dialogues[voice.order - 1]?.character
          if (characterName) {
            const character = await prisma.character.findFirst({
              where: { projectId, name: characterName }
            })
            if (character) {
              characterId = character.id
            }
          }
        }

        // 如果还是空，尝试通过 segment.characters 查找
        if (!characterId && segment.characters) {
          const dialogue = scene?.dialogues[voice.order - 1]
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
          console.warn(`VoiceSegment skipped: no character found for segment ${segmentRecord.id}, order ${voice.order}`)
          continue
        }

        await prisma.voiceSegment.create({
          data: {
            segmentId: segmentRecord.id,
            characterId,
            order: voice.order,
            startTimeMs: voice.startTimeMs,
            durationMs: voice.durationMs,
            text: voice.text,
            voiceConfig: voice.voiceConfig,
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

    // ========== 步骤 1: 剧本生成 ==========
    await updateStepResult(jobId, 'script-writing', { status: 'processing', input: { idea } })

    const scriptResult = await writeScriptFromIdea(idea, {
      characters: [] // TODO: 传入已有角色
    })

    const script = scriptResult.script
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

    const episodes = splitIntoEpisodes(script, {
      targetDuration: targetDuration || 60
    })

    await saveEpisodes(projectId, episodes)
    await updateStepResult(jobId, 'episode-split', {
      status: 'completed',
      output: { episodes }
    })
    await updateJobProgress(jobId, { currentStep: 'episode-split', progress: 45 })

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
      where: { projectId }
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
