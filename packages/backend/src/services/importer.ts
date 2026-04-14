import { normalizeProjectDefaultAspectRatio } from '../lib/project-aspect.js'
import { projectRepository } from '../repositories/project-repository.js'
import { characterRepository } from '../repositories/character-repository.js'
import { episodeRepository } from '../repositories/episode-repository.js'

export interface ParsedCharacter {
  name: string
  description: string
}

export interface ParsedScript {
  projectName?: string
  description?: string
  characters: ParsedCharacter[]
  episodes: {
    episodeNum: number
    title: string
    script: any
    scenes: {
      sceneNum: number
      description: string
      prompt: string
    }[]
  }[]
}

export interface ImportResults {
  episodesCreated: number
  episodesUpdated: number
  charactersCreated: number
  scenesCreated: number
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
    await characterRepository.createCharacter({
      projectId,
      name: char.name,
      description: char.description || `从剧本导入的角色: ${char.name}`
    })
    results.charactersCreated++
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
