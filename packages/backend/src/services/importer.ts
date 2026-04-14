import { prisma } from '../index.js'
import { normalizeProjectDefaultAspectRatio } from '../lib/project-aspect.js'

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

  const projectRow = await prisma.project.findUnique({
    where: { id: projectId },
    select: { aspectRatio: true }
  })
  const sceneAspectRatio = normalizeProjectDefaultAspectRatio(projectRow?.aspectRatio)

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

  for (const episodeData of parsed.episodes) {
    const existing = await prisma.episode.findFirst({
      where: {
        projectId,
        episodeNum: episodeData.episodeNum
      },
      include: { scenes: true }
    })

    if (existing) {
      await prisma.episode.update({
        where: { id: existing.id },
        data: {
          title: episodeData.title,
          rawScript: episodeData.script as object
        }
      })

      await prisma.scene.deleteMany({ where: { episodeId: existing.id } })

      for (const sc of episodeData.scenes) {
        const scene = await prisma.scene.create({
          data: {
            episodeId: existing.id,
            sceneNum: sc.sceneNum,
            description: sc.description,
            duration: 5000,
            aspectRatio: sceneAspectRatio,
            visualStyle: [],
            status: 'pending'
          }
        })
        await prisma.shot.create({
          data: {
            sceneId: scene.id,
            shotNum: 1,
            order: 1,
            description: sc.prompt,
            duration: 5000
          }
        })
        results.scenesCreated++
      }

      results.episodesUpdated++
    } else {
      const episode = await prisma.episode.create({
        data: {
          projectId,
          episodeNum: episodeData.episodeNum,
          title: episodeData.title,
          rawScript: episodeData.script as object
        }
      })

      for (const sc of episodeData.scenes) {
        const scene = await prisma.scene.create({
          data: {
            episodeId: episode.id,
            sceneNum: sc.sceneNum,
            description: sc.description,
            duration: 5000,
            aspectRatio: sceneAspectRatio,
            visualStyle: [],
            status: 'pending'
          }
        })
        await prisma.shot.create({
          data: {
            sceneId: scene.id,
            shotNum: 1,
            order: 1,
            description: sc.prompt,
            duration: 5000
          }
        })
        results.scenesCreated++
      }

      results.episodesCreated++
    }
  }

  return results
}
