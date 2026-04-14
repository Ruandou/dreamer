import { normalizeProjectDefaultAspectRatio } from '../lib/project-aspect.js'
import { projectRepository } from '../repositories/project-repository.js'
import { characterRepository } from '../repositories/character-repository.js'
import { episodeRepository } from '../repositories/episode-repository.js'
import type { ParsedScript, ParsedCharacter } from './ai/parser.js'
import { normalizeParsedCharacterList } from './ai/parsed-script-types.js'

export type { ParsedScript, ParsedCharacter }

export interface ImportResults {
  episodesCreated: number
  episodesUpdated: number
  charactersCreated: number
  scenesCreated: number
}

async function createCharacterImagesForCharacter(
  characterId: string,
  char: ParsedCharacter
) {
  const [normalized] = normalizeParsedCharacterList([char])
  const images = normalized.images || []
  let baseImageId: string | null = null

  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const type = (img.type || 'base').toLowerCase()

    if (type === 'base') {
      const row = await characterRepository.createCharacterImage({
        characterId,
        name: img.name,
        type: 'base',
        description: img.description || undefined,
        prompt: null,
        avatarUrl: null,
        order: i
      })
      baseImageId = row.id
      continue
    }

    if (!baseImageId) {
      const baseRow = await characterRepository.createCharacterImage({
        characterId,
        name: '基础形象',
        type: 'base',
        description: char.description || undefined,
        prompt: null,
        avatarUrl: null,
        order: 0
      })
      baseImageId = baseRow.id
    }

    const maxOrder = await characterRepository.maxSiblingOrder(characterId, baseImageId)
    await characterRepository.createCharacterImage({
      characterId,
      name: img.name,
      type,
      parentId: baseImageId,
      description: img.description || undefined,
      prompt: null,
      avatarUrl: null,
      order: (maxOrder._max.order ?? 0) + 1
    })
  }
}

export async function importParsedData(projectId: string, parsed: ParsedScript): Promise<ImportResults> {
  const results: ImportResults = {
    episodesCreated: 0,
    episodesUpdated: 0,
    charactersCreated: 0,
    scenesCreated: 0
  }

  const projectRow = await projectRepository.findAspectRatioSelect(projectId)
  const sceneAspectRatio = normalizeProjectDefaultAspectRatio(projectRow?.aspectRatio)

  for (const char of parsed.characters) {
    const character = await characterRepository.createCharacter({
      projectId,
      name: char.name,
      description: char.description || `从剧本导入的角色: ${char.name}`
    })
    results.charactersCreated++
    await createCharacterImagesForCharacter(character.id, char)
  }

  for (const episodeData of parsed.episodes) {
    const existing = await episodeRepository.findUniqueByProjectEpisodeWithScenes(
      projectId,
      episodeData.episodeNum
    )

    if (existing) {
      await episodeRepository.update(existing.id, {
        title: episodeData.title,
        rawScript: episodeData.script as object
      })

      await episodeRepository.deleteScenesByEpisode(existing.id)

      for (const sc of episodeData.scenes) {
        const scene = await episodeRepository.createScene({
          episodeId: existing.id,
          sceneNum: sc.sceneNum,
          description: sc.description,
          duration: 5000,
          aspectRatio: sceneAspectRatio,
          visualStyle: [],
          status: 'pending'
        })
        await episodeRepository.createShot({
          sceneId: scene.id,
          shotNum: 1,
          order: 1,
          description: sc.prompt,
          duration: 5000
        })
        results.scenesCreated++
      }

      results.episodesUpdated++
    } else {
      const episode = await episodeRepository.create({
        projectId,
        episodeNum: episodeData.episodeNum,
        title: episodeData.title,
        rawScript: episodeData.script as object
      })

      for (const sc of episodeData.scenes) {
        const scene = await episodeRepository.createScene({
          episodeId: episode.id,
          sceneNum: sc.sceneNum,
          description: sc.description,
          duration: 5000,
          aspectRatio: sceneAspectRatio,
          visualStyle: [],
          status: 'pending'
        })
        await episodeRepository.createShot({
          sceneId: scene.id,
          shotNum: 1,
          order: 1,
          description: sc.prompt,
          duration: 5000
        })
        results.scenesCreated++
      }

      results.episodesCreated++
    }
  }

  return results
}
