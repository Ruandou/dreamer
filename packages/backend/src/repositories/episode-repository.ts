import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class EpisodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findManyByProject(projectId: string) {
    return this.prisma.episode.findMany({
      where: { projectId },
      orderBy: { episodeNum: 'asc' }
    })
  }

  findUnique(episodeId: string) {
    return this.prisma.episode.findUnique({ where: { id: episodeId } })
  }

  /** 导入剧本：按 projectId + episodeNum 唯一键，带 scenes（用于替换分镜） */
  findUniqueByProjectEpisodeWithScenes(projectId: string, episodeNum: number) {
    return this.prisma.episode.findUnique({
      where: { projectId_episodeNum: { projectId, episodeNum } },
      include: { scenes: true }
    })
  }

  findUniqueWithScenesTakesForCompose(episodeId: string) {
    return this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        scenes: {
          orderBy: { sceneNum: 'asc' },
          include: {
            takes: { where: { isSelected: true } }
          }
        }
      }
    })
  }

  create(data: Prisma.EpisodeUncheckedCreateInput) {
    return this.prisma.episode.create({ data })
  }

  update(episodeId: string, data: Prisma.EpisodeUpdateInput) {
    return this.prisma.episode.update({
      where: { id: episodeId },
      data
    })
  }

  delete(episodeId: string) {
    return this.prisma.episode.delete({ where: { id: episodeId } })
  }

  findCompositionByEpisode(episodeId: string) {
    return this.prisma.composition.findFirst({ where: { episodeId } })
  }

  createComposition(data: Prisma.CompositionUncheckedCreateInput) {
    return this.prisma.composition.create({ data })
  }

  updateComposition(compositionId: string, data: Prisma.CompositionUpdateInput) {
    return this.prisma.composition.update({
      where: { id: compositionId },
      data
    })
  }

  deleteCompositionScenesByComposition(compositionId: string) {
    return this.prisma.compositionScene.deleteMany({ where: { compositionId } })
  }

  createCompositionScenes(
    rows: Array<{
      compositionId: string
      sceneId: string
      takeId: string
      order: number
    }>
  ) {
    return this.prisma.compositionScene.createMany({ data: rows })
  }

  findProjectForExpandScript(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        characters: { select: { name: true, description: true } },
        episodes: { select: { title: true, episodeNum: true } }
      }
    })
  }

  deleteScenesByEpisode(episodeId: string) {
    return this.prisma.scene.deleteMany({ where: { episodeId } })
  }

  findLocationByProjectAndName(projectId: string, name: string) {
    return this.prisma.location.findFirst({
      where: { projectId, name, deletedAt: null }
    })
  }

  createScene(data: Prisma.SceneUncheckedCreateInput) {
    return this.prisma.scene.create({ data })
  }

  createShot(data: Prisma.ShotUncheckedCreateInput) {
    return this.prisma.shot.create({ data })
  }
}

export const episodeRepository = new EpisodeRepository(prisma)
