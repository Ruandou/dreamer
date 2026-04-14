import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class CompositionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findManyByProject(projectId: string) {
    return this.prisma.composition.findMany({
      where: { projectId },
      include: { scenes: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    })
  }

  findUniqueWithScenesTakes(compositionId: string) {
    return this.prisma.composition.findUnique({
      where: { id: compositionId },
      include: {
        scenes: {
          orderBy: { order: 'asc' },
          include: { take: true, scene: true }
        }
      }
    })
  }

  findUniqueById(compositionId: string) {
    return this.prisma.composition.findUnique({ where: { id: compositionId } })
  }

  create(data: Prisma.CompositionUncheckedCreateInput) {
    return this.prisma.composition.create({ data })
  }

  update(compositionId: string, data: Prisma.CompositionUpdateInput) {
    return this.prisma.composition.update({
      where: { id: compositionId },
      data
    })
  }

  delete(compositionId: string) {
    return this.prisma.composition.delete({ where: { id: compositionId } })
  }

  deleteScenesByComposition(compositionId: string) {
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

  findUniqueWithScenesOrdered(compositionId: string) {
    return this.prisma.composition.findUnique({
      where: { id: compositionId },
      include: { scenes: { orderBy: { order: 'asc' } } }
    })
  }

  /** 成片导出：分镜顺序 + 每段 take 视频 URL */
  findUniqueForExport(compositionId: string) {
    return this.prisma.composition.findUnique({
      where: { id: compositionId },
      include: {
        scenes: {
          orderBy: { order: 'asc' },
          include: { take: true }
        }
      }
    })
  }
}

export const compositionRepository = new CompositionRepository(prisma)
