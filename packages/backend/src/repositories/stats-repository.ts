import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class StatsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findProjectForCostStats(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        episodes: {
          include: {
            scenes: {
              include: {
                takes: true
              }
            }
          }
        },
        importTasks: {
          where: { status: 'completed' }
        }
      }
    })
  }

  findManyProjectsForUserCostStats(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      include: {
        episodes: {
          include: {
            scenes: {
              include: {
                takes: true
              }
            }
          }
        },
        importTasks: {
          where: { status: 'completed' }
        }
      }
    })
  }

  async sumImageCostForProject(projectId: string): Promise<number> {
    const [charSum, locSum] = await Promise.all([
      this.prisma.characterImage.aggregate({
        where: { character: { projectId } },
        _sum: { imageCost: true }
      }),
      this.prisma.location.aggregate({
        where: { projectId },
        _sum: { imageCost: true }
      })
    ])
    return (charSum._sum.imageCost ?? 0) + (locSum._sum.imageCost ?? 0)
  }

  findTakesForTrend(where: Prisma.TakeWhereInput) {
    return this.prisma.take.findMany({
      where,
      select: {
        cost: true,
        createdAt: true,
        model: true
      },
      orderBy: { createdAt: 'asc' }
    })
  }

  findCharacterImagesForTrend(where: Prisma.CharacterImageWhereInput) {
    return this.prisma.characterImage.findMany({
      where,
      select: { imageCost: true, updatedAt: true }
    })
  }

  findLocationsForTrend(where: Prisma.LocationWhereInput) {
    return this.prisma.location.findMany({
      where,
      select: { imageCost: true, updatedAt: true }
    })
  }
}

export const statsRepository = new StatsRepository(prisma)
