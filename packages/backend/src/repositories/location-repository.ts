import type { Prisma, PrismaClient } from '@prisma/client'

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
}
