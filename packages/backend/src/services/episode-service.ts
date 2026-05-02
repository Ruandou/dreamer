import type { Episode as PrismaEpisode, Prisma } from '@prisma/client'
import type { ScriptContent } from '@dreamer/shared/types'
import { prisma } from '../lib/prisma.js'
import {
  expandScript,
  generateStoryboardScriptFromEpisode,
  hasEpisodeContentForStoryboard
} from './ai/deepseek.js'
import { runCompositionExport } from './composition-export.js'
import { episodeRepository, type EpisodeRepository } from '../repositories/episode-repository.js'
import { pipelineRepository } from '../repositories/pipeline-repository.js'
import { sceneRepository } from '../repositories/scene-repository.js'
import { safeExtractAndSaveMemories } from './memory/index.js'
import { DEFAULT_SHOT_DURATION_MS, MAX_SCENE_DURATION_MS } from './episode-service.constants.js'
import { classifyAIError, buildProjectContext } from './ai/error-classifier.js'
import { PromptBuilder } from './prompts/prompt-builder.js'
import { logError } from '../lib/error-logger.js'

const DEFAULT_VOICE_CONFIG: Prisma.InputJsonValue = {
  gender: 'male',
  age: 'young',
  tone: 'mid',
  timbre: 'warm_solid',
  speed: 'medium'
}

function scriptSceneCharacterCounts(script: unknown): {
  scriptSceneCount: number
  scriptCharacterCount: number
} {
  if (script == null || typeof script !== 'object') {
    return { scriptSceneCount: 0, scriptCharacterCount: 0 }
  }
  const scenes = (script as ScriptContent).scenes
  if (!Array.isArray(scenes)) {
    return { scriptSceneCount: 0, scriptCharacterCount: 0 }
  }
  const names = new Set<string>()
  for (const scene of scenes) {
    if (scene && typeof scene === 'object' && Array.isArray(scene.characters)) {
      for (const name of scene.characters) {
        if (typeof name === 'string' && name.trim()) names.add(name.trim())
      }
    }
  }
  return { scriptSceneCount: scenes.length, scriptCharacterCount: names.size }
}

function buildScenePrompt(
  scene: {
    location?: string
    timeOfDay?: string
    description?: string
    actions?: string[]
    dialogues?: Array<{ character: string; content: string }>
  },
  scriptTitle: string
): string {
  return new PromptBuilder(', ')
    .add(scriptTitle)
    .add(scene.location)
    .add(scene.timeOfDay)
    .add(scene.description)
    .addList(scene.actions, ' ')
    .addList(
      scene.dialogues?.map((dialogue) => `${dialogue.character}: ${dialogue.content}`),
      ' '
    )
    .build()
}

export type ComposeEpisodeResult =
  | { ok: true; compositionId: string; outputUrl: string; duration: number }
  | { ok: false; status: 400; error: string; details?: string[] }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: number; error: string; compositionId: string }

export type ExpandEpisodeResult =
  | {
      ok: true
      episode: PrismaEpisode
      script: unknown
      scenesCreated: number
      aiCost: number
    }
  | { ok: false; status: 400; error: string; message: string }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 401; error: string; message: string }
  | { ok: false; status: 429; error: string; message: string }
  | { ok: false; status: 500; error: string; message: string }

export class EpisodeService {
  constructor(private readonly repo: EpisodeRepository) {}

  /** 将结构化剧本写入本集 `Episode.script`，并按场次生成 DB Scene + 首镜 Shot */
  private async applyScriptContentToEpisode(
    episodeId: string,
    projectId: string,
    episodeTitle: string | null | undefined,
    script: ScriptContent
  ): Promise<{ updatedEpisode: PrismaEpisode; scenesCreated: number }> {
    const project = await this.repo.findProjectForExpandScript(projectId)

    const updatedEpisode = await this.repo.update(episodeId, {
      title: script.title || episodeTitle || undefined,
      script: script as unknown as Prisma.InputJsonValue
    })

    if (!script.scenes?.length) {
      return { updatedEpisode, scenesCreated: 0 }
    }

    await this.repo.deleteScenesByEpisode(episodeId)

    // 批量预加载项目角色与形象，避免 N+1 查询
    const allCharacters = await prisma.character.findMany({ where: { projectId } })
    const charMapByName = new Map(allCharacters.map((c) => [c.name, c]))
    const allImages = await prisma.characterImage.findMany({
      where: { characterId: { in: allCharacters.map((c) => c.id) } }
    })
    const imagesByCharId = new Map<string, typeof allImages>()
    for (const img of allImages) {
      const list = imagesByCharId.get(img.characterId) || []
      list.push(img)
      imagesByCharId.set(img.characterId, list)
    }

    for (const sceneData of script.scenes) {
      let locationId: string | undefined
      if (sceneData.location) {
        const location = await this.repo.findLocationByProjectAndName(projectId, sceneData.location)
        locationId = location?.id
      }

      const hasShots = sceneData.shots && sceneData.shots.length > 0
      let sceneDurationMs = DEFAULT_SHOT_DURATION_MS
      if (hasShots && sceneData.shots) {
        sceneDurationMs = sceneData.shots.reduce(
          (sum, shot) => sum + (shot.duration ?? DEFAULT_SHOT_DURATION_MS),
          0
        )
      }
      sceneDurationMs = Math.min(sceneDurationMs, MAX_SCENE_DURATION_MS)

      const scene = await this.repo.createScene({
        episodeId,
        sceneNum: sceneData.sceneNum || 1,
        locationId,
        timeOfDay: sceneData.timeOfDay,
        description: sceneData.description || `${sceneData.location} - ${sceneData.timeOfDay}`,
        duration: sceneDurationMs,
        aspectRatio: project?.aspectRatio ?? '9:16',
        visualStyle: [], // visualStyle deprecated; use visualStyleConfig
        status: 'pending'
      })

      if (hasShots && sceneData.shots) {
        const sorted = [...sceneData.shots].sort(
          (a, b) => (a.order ?? a.shotNum ?? 0) - (b.order ?? b.shotNum ?? 0)
        )
        let shotIndex = 0
        for (const shotData of sorted) {
          shotIndex += 1
          const shot = await this.repo.createShot({
            sceneId: scene.id,
            shotNum: shotData.shotNum ?? shotIndex,
            order: shotData.order ?? shotIndex,
            description: shotData.description ?? '',
            duration: shotData.duration ?? DEFAULT_SHOT_DURATION_MS,
            cameraAngle: shotData.cameraAngle ?? null,
            cameraMovement: shotData.cameraMovement ?? null
          })
          for (const characterData of shotData.characters || []) {
            const character = charMapByName.get(characterData.characterName)
            if (!character) continue
            const characterImages = imagesByCharId.get(character.id) ?? []
            let matchedImage = characterImages.find(
              (image) => image.name === characterData.imageName
            )
            if (!matchedImage) {
              matchedImage = characterImages.find((image) => image.type === 'base')
            }
            if (!matchedImage) continue
            await prisma.characterShot.create({
              data: {
                shotId: shot.id,
                characterImageId: matchedImage.id,
                action: characterData.action ?? null
              }
            })
          }
        }
      } else {
        await this.repo.createShot({
          sceneId: scene.id,
          shotNum: 1,
          order: 1,
          description: buildScenePrompt(sceneData, script.title ?? ''),
          duration: DEFAULT_SHOT_DURATION_MS
        })
      }

      if (sceneData.dialogues?.length) {
        const dialogueCount = sceneData.dialogues.length
        const timeSlot = Math.max(1000, Math.floor(sceneDurationMs / dialogueCount))
        let currentTime = 0
        for (let index = 0; index < sceneData.dialogues.length; index++) {
          const dialogue = sceneData.dialogues[index]
          const character = charMapByName.get(dialogue.character)
          if (!character) continue
          const voiceConfigRaw = character.voiceConfig
          const voiceConfig =
            voiceConfigRaw && typeof voiceConfigRaw === 'object' && !Array.isArray(voiceConfigRaw)
              ? (voiceConfigRaw as Prisma.InputJsonValue)
              : DEFAULT_VOICE_CONFIG
          await prisma.sceneDialogue.create({
            data: {
              sceneId: scene.id,
              characterId: character.id,
              order: index + 1,
              startTimeMs: currentTime,
              durationMs: timeSlot,
              text: dialogue.content,
              voiceConfig
            }
          })
          currentTime += timeSlot
        }
      }
    }

    return { updatedEpisode, scenesCreated: script.scenes.length }
  }

  async listByProject(projectId: string) {
    const episodes = await this.repo.findManyByProject(projectId)
    return this.attachEpisodeListStats(episodes)
  }

  private async attachEpisodeListStats(episodes: PrismaEpisode[]) {
    if (episodes.length === 0) return []
    const ids = episodes.map((e) => e.id)
    const projectId = episodes[0].projectId
    const [sceneGroups, dialogueRows, shotRows, storyboardCompletedIds] = await Promise.all([
      prisma.scene.groupBy({
        by: ['episodeId'],
        where: { episodeId: { in: ids } },
        _count: { _all: true }
      }),
      prisma.sceneDialogue.findMany({
        where: { scene: { episodeId: { in: ids } } },
        select: {
          characterId: true,
          scene: { select: { episodeId: true } }
        }
      }),
      prisma.characterShot.findMany({
        where: { shot: { scene: { episodeId: { in: ids } } } },
        select: {
          characterImage: { select: { characterId: true } },
          shot: { select: { scene: { select: { episodeId: true } } } }
        }
      }),
      pipelineRepository.findEpisodeIdsWithCompletedStoryboardScript(projectId)
    ])

    const storyboardSceneCountByEpisode = new Map<string, number>()
    for (const row of sceneGroups) {
      storyboardSceneCountByEpisode.set(row.episodeId, row._count._all)
    }

    const charIdsByEpisode = new Map<string, Set<string>>()
    const addChar = (episodeId: string, characterId: string) => {
      if (!charIdsByEpisode.has(episodeId)) charIdsByEpisode.set(episodeId, new Set())
      const charSet = charIdsByEpisode.get(episodeId)
      if (charSet) {
        charSet.add(characterId)
      }
    }
    for (const r of dialogueRows) {
      addChar(r.scene.episodeId, r.characterId)
    }
    for (const r of shotRows) {
      addChar(r.shot.scene.episodeId, r.characterImage.characterId)
    }

    return episodes.map((ep) => {
      const sc = scriptSceneCharacterCounts(ep.script)
      const storyboardSceneCount = storyboardSceneCountByEpisode.get(ep.id) ?? 0
      const storyboardCharacterCount = charIdsByEpisode.get(ep.id)?.size ?? 0
      const hasStoryboardScenes = storyboardSceneCount > 0
      const storyboardScriptJobCompleted = storyboardCompletedIds.has(ep.id)

      // Compute writeStatus based on content length
      const contentLen = (ep.content || '').replace(/\s/g, '').length
      const computedWriteStatus =
        contentLen > 500 ? 'completed' : contentLen > 0 ? 'writing' : 'pending'

      return {
        ...ep,
        writeStatus: computedWriteStatus,
        listStats: {
          scriptSceneCount: sc.scriptSceneCount,
          scriptCharacterCount: sc.scriptCharacterCount,
          storyboardSceneCount,
          storyboardCharacterCount,
          hasStoryboardScenes,
          storyboardScriptJobCompleted
        }
      }
    })
  }

  async getById(episodeId: string) {
    const episode = await this.repo.findUnique(episodeId)
    if (!episode) return null
    const [enriched] = await this.attachEpisodeListStats([episode])
    return enriched
  }

  /** 集详情页：单请求拉取集元数据 + 全量场景树 + 项目画风 */
  async getEpisodeDetail(episodeId: string) {
    const episode = await this.getById(episodeId)
    if (!episode) return null
    const project = await prisma.project.findUnique({
      where: { id: episode.projectId },
      select: { visualStyle: true }
    })
    const scenes = await this.listScenesForEpisode(episodeId)
    return {
      episode,
      scenes,
      project: { visualStyle: project?.visualStyle ?? [] }
    }
  }

  /** 分集管理 Tab：场次 + 定场 + 多镜 + CharacterShot + 台词 + takes */
  listScenesForEpisode(episodeId: string) {
    return sceneRepository.findManyByEpisodeForEditor(episodeId)
  }

  createEpisode(projectId: string, episodeNum: number, title?: string) {
    return this.repo.create({
      projectId,
      episodeNum,
      ...(title !== undefined ? { title } : {})
    })
  }

  updateEpisode(
    episodeId: string,
    body: {
      title?: string
      synopsis?: string | null
      script?: unknown
      content?: string
      hook?: string
      cliffhanger?: string
      isPaywall?: boolean
      writeStatus?: string
    }
  ) {
    const { title, synopsis, script, content, hook, cliffhanger, isPaywall, writeStatus } = body

    const data: Prisma.EpisodeUpdateInput = {
      ...(title !== undefined && { title }),
      ...(synopsis !== undefined && { synopsis }),
      ...(script !== undefined && { script: script as Prisma.InputJsonValue }),
      ...(content !== undefined && { content }),
      ...(hook !== undefined && { hook }),
      ...(cliffhanger !== undefined && { cliffhanger }),
      ...(isPaywall !== undefined && { isPaywall }),
      ...(writeStatus !== undefined && { writeStatus })
    }

    return this.repo.update(episodeId, data)
  }

  async deleteEpisodeIfExists(episodeId: string): Promise<boolean> {
    const ep = await this.repo.findUnique(episodeId)
    if (!ep) return false
    await this.repo.delete(episodeId)
    return true
  }

  async composeEpisode(episodeId: string, titleOverride?: string): Promise<ComposeEpisodeResult> {
    const episode = await this.repo.findUniqueWithScenesTakesForCompose(episodeId)
    if (!episode) {
      return { ok: false, status: 404, error: 'Episode not found' }
    }

    const issues: string[] = []
    const clips: { sceneId: string; takeId: string; order: number }[] = []

    let order = 0
    for (const scene of episode.scenes) {
      const selected = scene.takes[0]
      if (!selected) {
        issues.push(`第 ${scene.sceneNum} 场未选择成片 Take`)
        continue
      }
      if (selected.status !== 'completed' || !selected.videoUrl) {
        issues.push(`第 ${scene.sceneNum} 场所选 Take 尚无成片视频`)
        continue
      }
      order += 1
      clips.push({ sceneId: scene.id, takeId: selected.id, order })
    }

    if (clips.length === 0) {
      if (episode.scenes.length === 0) {
        return { ok: false, status: 400, error: '该集暂无场次' }
      }
      return { ok: false, status: 400, error: '无法合成', details: issues }
    }

    let composition = await this.repo.findCompositionByEpisode(episodeId)

    const defaultTitle = titleOverride?.trim() || episode.title || `第${episode.episodeNum}集`

    if (!composition) {
      composition = await this.repo.createComposition({
        projectId: episode.projectId,
        episodeId,
        title: defaultTitle
      })
    } else if (titleOverride?.trim()) {
      composition = await this.repo.updateComposition(composition.id, {
        title: titleOverride.trim()
      })
    }

    await this.repo.deleteCompositionScenesByComposition(composition.id)
    await this.repo.createCompositionScenes(
      clips.map((c) => ({
        compositionId: composition.id,
        sceneId: c.sceneId,
        takeId: c.takeId,
        order: c.order
      }))
    )

    const exportResult = await runCompositionExport(composition.id)
    if (!exportResult.ok) {
      return {
        ok: false,
        status: exportResult.httpStatus,
        error: exportResult.error,
        compositionId: composition.id
      }
    }

    return {
      ok: true,
      compositionId: composition.id,
      outputUrl: exportResult.outputUrl,
      duration: exportResult.duration
    }
  }

  async expandEpisodeScript(
    userId: string,
    episodeId: string,
    summary: string
  ): Promise<ExpandEpisodeResult> {
    const episode = await this.repo.findUnique(episodeId)
    if (!episode) {
      return { ok: false, status: 404, error: 'Episode not found' }
    }

    try {
      const project = await this.repo.findProjectForExpandScript(episode.projectId)

      const projectContext = buildProjectContext(project)

      const { script, cost } = await expandScript(summary, projectContext, {
        userId,
        projectId: episode.projectId,
        op: 'episode_expand_script'
      })

      const { updatedEpisode, scenesCreated } = await this.applyScriptContentToEpisode(
        episodeId,
        episode.projectId,
        episode.title,
        script
      )

      // 提取扩展剧本的记忆
      await safeExtractAndSaveMemories(episode.projectId, episode.episodeNum, episodeId, script, {
        userId,
        projectId: episode.projectId,
        op: 'extract_expanded_script_memories'
      })

      return {
        ok: true,
        episode: updatedEpisode,
        script,
        scenesCreated,
        aiCost: cost.costCNY
      }
    } catch (error) {
      logError('ScriptExpansion', error, {
        episodeId,
        operation: 'expand_episode_script'
      })
      return classifyAIError(error, '剧本生成失败')
    }
  }

  async generateEpisodeStoryboardScript(
    userId: string,
    episodeId: string,
    hint?: string | null
  ): Promise<ExpandEpisodeResult> {
    const episode = await this.repo.findUnique(episodeId)
    if (!episode) {
      return { ok: false, status: 404, error: 'Episode not found' }
    }

    if (!hasEpisodeContentForStoryboard(episode)) {
      return {
        ok: false,
        status: 400,
        error: '内容不足',
        message: '请先填写本集梗概，或导入/保存含场次或梗概字段的剧本'
      }
    }

    try {
      const project = await this.repo.findProjectForExpandScript(episode.projectId)

      const projectContext = buildProjectContext(project)

      const { script, cost } = await generateStoryboardScriptFromEpisode(
        episode,
        projectContext,
        {
          userId,
          projectId: episode.projectId,
          op: 'episode_generate_storyboard_script'
        },
        hint
      )

      const { updatedEpisode, scenesCreated } = await this.applyScriptContentToEpisode(
        episodeId,
        episode.projectId,
        episode.title,
        script
      )

      return {
        ok: true,
        episode: updatedEpisode,
        script,
        scenesCreated,
        aiCost: cost.costCNY
      }
    } catch (error) {
      logError('StoryboardScriptGeneration', error, {
        episodeId,
        operation: 'generate_storyboard_script'
      })
      return classifyAIError(error, '分镜剧本生成失败')
    }
  }
}

export const episodeService = new EpisodeService(episodeRepository)
