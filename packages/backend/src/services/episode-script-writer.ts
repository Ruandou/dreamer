/**
 * Episode Script Writer
 * 负责将结构化剧本写入 Episode 并创建场景/镜头/对话
 */

import type { Episode as PrismaEpisode, Prisma, Character, CharacterImage } from '@prisma/client'
import type { ScriptContent } from '@dreamer/shared/types'
import { prisma } from '../lib/prisma.js'
import { episodeRepository, type EpisodeRepository } from '../repositories/episode-repository.js'
import { DEFAULT_SHOT_DURATION_MS, MAX_SCENE_DURATION_MS } from './episode-service.constants.js'
import { PromptBuilder } from './prompts/prompt-builder.js'

const DEFAULT_VOICE_CONFIG: Prisma.InputJsonValue = {
  gender: 'male',
  age: 'young',
  tone: 'mid',
  timbre: 'warm_solid',
  speed: 'medium'
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

export class EpisodeScriptWriter {
  constructor(private readonly repo: EpisodeRepository) {}

  /**
   * 将结构化剧本写入本集，并按场次创建 DB Scene + 首镜 Shot + 对话
   */
  async applyScriptContent(
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
    const { charMapByName, imagesByCharId } = await this.loadCharacterData(projectId)

    for (const sceneData of script.scenes) {
      await this.createSceneWithShotsAndDialogues(
        episodeId,
        projectId,
        sceneData,
        script.title ?? '',
        charMapByName,
        imagesByCharId,
        project?.aspectRatio ?? '9:16'
      )
    }

    return { updatedEpisode, scenesCreated: script.scenes.length }
  }

  private async loadCharacterData(projectId: string) {
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
    return { charMapByName, imagesByCharId }
  }

  private async createSceneWithShotsAndDialogues(
    episodeId: string,
    projectId: string,
    sceneData: ScriptContent['scenes'][0],
    scriptTitle: string,
    charMapByName: Map<string, Character>,
    imagesByCharId: Map<string, CharacterImage[]>,
    aspectRatio: string
  ): Promise<void> {
    let locationId: string | undefined
    if (sceneData.location) {
      const location = await episodeRepository.findLocationByProjectAndName(
        projectId,
        sceneData.location
      )
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

    const scene = await episodeRepository.createScene({
      episodeId,
      sceneNum: sceneData.sceneNum || 1,
      locationId,
      timeOfDay: sceneData.timeOfDay,
      description: sceneData.description || `${sceneData.location} - ${sceneData.timeOfDay}`,
      duration: sceneDurationMs,
      aspectRatio,
      visualStyle: [],
      status: 'pending'
    })

    if (hasShots && sceneData.shots) {
      await this.createShots(scene.id, sceneData.shots, charMapByName, imagesByCharId)
    } else {
      await episodeRepository.createShot({
        sceneId: scene.id,
        shotNum: 1,
        order: 1,
        description: buildScenePrompt(sceneData, scriptTitle),
        duration: DEFAULT_SHOT_DURATION_MS
      })
    }

    if (sceneData.dialogues?.length) {
      await this.createDialogues(scene.id, sceneData.dialogues, sceneDurationMs, charMapByName)
    }
  }

  private async createShots(
    sceneId: string,
    shots: ScriptContent['scenes'][0]['shots'],
    charMapByName: Map<string, Character>,
    imagesByCharId: Map<string, CharacterImage[]>
  ): Promise<void> {
    const sorted = [...(shots || [])].sort(
      (a, b) => (a.order ?? a.shotNum ?? 0) - (b.order ?? b.shotNum ?? 0)
    )
    let shotIndex = 0
    for (const shotData of sorted) {
      shotIndex += 1
      const shot = await episodeRepository.createShot({
        sceneId,
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
        let matchedImage = characterImages.find((image) => image.name === characterData.imageName)
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
  }

  private async createDialogues(
    sceneId: string,
    dialogues: ScriptContent['scenes'][0]['dialogues'],
    sceneDurationMs: number,
    charMapByName: Map<string, Character>
  ): Promise<void> {
    const dialogueCount = dialogues.length
    const timeSlot = Math.max(1000, Math.floor(sceneDurationMs / dialogueCount))
    let currentTime = 0
    for (let index = 0; index < dialogues.length; index++) {
      const dialogue = dialogues[index]
      const character = charMapByName.get(dialogue.character)
      if (!character) continue
      const voiceConfigRaw = character.voiceConfig
      const voiceConfig =
        voiceConfigRaw && typeof voiceConfigRaw === 'object' && !Array.isArray(voiceConfigRaw)
          ? (voiceConfigRaw as Prisma.InputJsonValue)
          : DEFAULT_VOICE_CONFIG
      await prisma.sceneDialogue.create({
        data: {
          sceneId,
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

export const episodeScriptWriter = new EpisodeScriptWriter(episodeRepository)
