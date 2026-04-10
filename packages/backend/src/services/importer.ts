import { prisma } from '../index.js'

export interface ParsedCharacter {
  name: string
  description: string  // 角色外貌描述
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

  // Create characters with AI-extracted descriptions
  for (const char of parsed.characters) {
    await prisma.character.create({
      data: {
        projectId,
        name: char.name,
        description: char.description || `从剧本导入的角色: ${char.name}`
      }
    })
    results.charactersCreated++
  }

  // Create/update episodes
  for (const episodeData of parsed.episodes) {
    const existing = await prisma.episode.findFirst({
      where: {
        projectId,
        episodeNum: episodeData.episodeNum
      },
      include: { scenes: true }
    })

    if (existing) {
      // Update existing episode
      await prisma.episode.update({
        where: { id: existing.id },
        data: {
          title: episodeData.title,
          script: episodeData.script as any
        }
      })

      // Delete old scenes and create new ones
      await prisma.scene.deleteMany({ where: { episodeId: existing.id } })

      for (const scene of episodeData.scenes) {
        await prisma.scene.create({
          data: {
            episodeId: existing.id,
            sceneNum: scene.sceneNum,
            description: scene.description,
            prompt: scene.prompt
          }
        })
        results.scenesCreated++
      }

      results.episodesUpdated++
    } else {
      // Create new episode
      const episode = await prisma.episode.create({
        data: {
          projectId,
          episodeNum: episodeData.episodeNum,
          title: episodeData.title,
          script: episodeData.script as any
        }
      })

      // Create scenes
      for (const scene of episodeData.scenes) {
        await prisma.scene.create({
          data: {
            episodeId: episode.id,
            sceneNum: scene.sceneNum,
            description: scene.description,
            prompt: scene.prompt
          }
        })
        results.scenesCreated++
      }

      results.episodesCreated++
    }
  }

  return results
}
