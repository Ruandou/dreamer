import { prisma } from '../lib/prisma.js'
import { runCompositionExport } from './composition-export.js'
import { CompositionRepository } from '../repositories/composition-repository.js'

export class CompositionService {
  constructor(private readonly repo: CompositionRepository) {}

  listByProject(projectId: string) {
    return this.repo.findManyByProject(projectId)
  }

  async getDetailEnriched(compositionId: string) {
    const composition = await this.repo.findUniqueWithScenesTakes(compositionId)
    if (!composition) {
      return null
    }

    const enrichedScenes = composition.scenes.map(row => ({
      ...row,
      videoUrl: row.take.videoUrl || null,
      thumbnailUrl: row.take.thumbnailUrl || null
    }))

    return {
      ...composition,
      scenes: enrichedScenes
    }
  }

  create(projectId: string, episodeId: string, title: string) {
    return this.repo.create({ projectId, episodeId, title })
  }

  updateTitle(compositionId: string, title: string | undefined) {
    return this.repo.update(compositionId, { title })
  }

  async deleteIfExists(compositionId: string): Promise<boolean> {
    const composition = await this.repo.findUniqueById(compositionId)
    if (!composition) {
      return false
    }
    await this.repo.delete(compositionId)
    return true
  }

  async updateTimeline(
    compositionId: string,
    clips: Array<{ sceneId: string; takeId: string; order: number }>
  ) {
    await this.repo.deleteScenesByComposition(compositionId)

    if (clips.length > 0) {
      await this.repo.createCompositionScenes(
        clips.map(c => ({
          compositionId,
          sceneId: c.sceneId,
          takeId: c.takeId,
          order: c.order
        }))
      )
    }

    return this.repo.findUniqueWithScenesOrdered(compositionId)
  }

  async exportComposition(compositionId: string) {
    return runCompositionExport(compositionId)
  }
}

export const compositionRepository = new CompositionRepository(prisma)
export const compositionService = new CompositionService(compositionRepository)
