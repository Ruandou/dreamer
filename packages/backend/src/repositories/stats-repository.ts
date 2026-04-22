import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export interface ProjectCostData {
  id: string
  name: string
  takes: Array<{
    id: string
    model: string | null
    cost: number | null
    status: string
    createdAt: Date
  }>
  importAiCosts: number
}

export class StatsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get project cost data using optimized queries.
   * Instead of loading full episode→scene→take tree, we query takes directly.
   */
  async findProjectForCostStats(projectId: string): Promise<ProjectCostData | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true }
    })
    if (!project) return null

    // Query takes directly via scenes→episodes relationship
    const takes = await this.prisma.take.findMany({
      where: {
        scene: { episode: { projectId } }
      },
      select: {
        id: true,
        model: true,
        cost: true,
        status: true,
        createdAt: true
      }
    })

    // Sum AI costs from import tasks
    const importTasks = await this.prisma.importTask.findMany({
      where: { projectId, status: 'completed' },
      select: { result: true }
    })
    const importAiCosts = importTasks.reduce((sum, t) => {
      const result = t.result as { aiCost?: number } | null
      return sum + (result?.aiCost || 0)
    }, 0)

    return {
      id: project.id,
      name: project.name,
      takes,
      importAiCosts
    }
  }

  /**
   * Get cost data for all projects of a user.
   */
  async findManyProjectsForUserCostStats(userId: string): Promise<ProjectCostData[]> {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      select: { id: true, name: true }
    })

    // Get all takes for all projects in a single query
    const projectIds = projects.map((p) => p.id)
    const takes = await this.prisma.take.findMany({
      where: {
        scene: { episode: { projectId: { in: projectIds } } }
      },
      select: {
        id: true,
        model: true,
        cost: true,
        status: true,
        createdAt: true,
        scene: { select: { episode: { select: { projectId: true } } } }
      }
    })

    // Group takes by projectId
    const takesByProject = new Map<string, typeof takes>()
    for (const take of takes) {
      const pid = take.scene.episode.projectId
      if (!takesByProject.has(pid)) takesByProject.set(pid, [])
      const list = takesByProject.get(pid)
      if (list) list.push(take)
    }

    // Get import task costs for all projects
    const importTasks = await this.prisma.importTask.findMany({
      where: {
        projectId: { in: projectIds },
        status: 'completed'
      },
      select: { projectId: true, result: true }
    })
    const importCostsByProject = new Map<string, number>()
    for (const t of importTasks) {
      if (!t.projectId) continue
      const result = t.result as { aiCost?: number } | null
      const current = importCostsByProject.get(t.projectId) || 0
      importCostsByProject.set(t.projectId, current + (result?.aiCost || 0))
    }

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      takes: takesByProject.get(p.id) || [],
      importAiCosts: importCostsByProject.get(p.id) || 0
    }))
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
