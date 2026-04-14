import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class LocationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findManyByProjectOrdered(projectId: string) {
    return this.prisma.location.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { name: 'asc' }
    })
  }

  findManyWithProjectForBatch(projectId: string) {
    return this.prisma.location.findMany({
      where: { projectId, deletedAt: null },
      include: { project: true },
      orderBy: { name: 'asc' }
    })
  }

  findFirstActiveById(id: string) {
    return this.prisma.location.findFirst({
      where: { id, deletedAt: null }
    })
  }

  findFirstActiveWithProjectById(id: string) {
    return this.prisma.location.findFirst({
      where: { id, deletedAt: null },
      include: { project: true }
    })
  }

  update(id: string, data: Prisma.LocationUpdateInput) {
    return this.prisma.location.update({ where: { id }, data })
  }

  unlinkScenesFromLocation(locationId: string) {
    return this.prisma.scene.updateMany({
      where: { locationId },
      data: { locationId: null }
    })
  }

  softDelete(locationId: string) {
    return this.prisma.location.update({
      where: { id: locationId },
      data: { deletedAt: new Date() }
    })
  }

  /** 定场图队列：仅更新未软删场地 */
  updateManyActiveImage(
    locationId: string,
    data: { imageUrl: string; imageCost: number | null }
  ) {
    return this.prisma.location.updateMany({
      where: { id: locationId, deletedAt: null },
      data: { imageUrl: data.imageUrl, imageCost: data.imageCost }
    })
  }

  /** 文学剧本落库：按项目+场地名 upsert，并恢复软删 */
  upsertFromScriptScene(
    projectId: string,
    locationName: string,
    info: { timeOfDay?: string; description?: string }
  ) {
    return this.prisma.location.upsert({
      where: { projectId_name: { projectId, name: locationName } },
      update: {
        timeOfDay: info.timeOfDay,
        description: info.description,
        deletedAt: null
      },
      create: {
        projectId,
        name: locationName,
        timeOfDay: info.timeOfDay || '日',
        description: info.description
      }
    })
  }

  updateManyActiveImagePromptByProjectAndName(
    projectId: string,
    locationName: string,
    imagePrompt: string
  ) {
    return this.prisma.location.updateMany({
      where: { projectId, name: locationName, deletedAt: null },
      data: { imagePrompt }
    })
  }
}

export const locationRepository = new LocationRepository(prisma)
