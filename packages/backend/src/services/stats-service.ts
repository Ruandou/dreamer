import { prisma } from '../lib/prisma.js'
import { getDeepSeekBalance } from './deepseek.js'
import { StatsRepository } from '../repositories/stats-repository.js'

export interface ProjectCostStats {
  projectId: string
  projectName: string
  totalCost: number
  aiCost: number
  videoCost: number
  /** 角色定妆 + 场地定场图，方舟 imageCost 汇总（各资产最近一次成功估算） */
  imageCost: number
  totalTasks: number
  completedTasks: number
  failedTasks: number
  tasksByModel: {
    wan2dot6: { count: number; cost: number }
    seedance2dot0: { count: number; cost: number }
  }
  recentTasks: Array<{
    id: string
    model: string
    cost: number
    status: string
    createdAt: Date
  }>
}

export interface UserCostStats {
  userId: string
  totalCost: number
  aiCost: number
  videoCost: number
  imageCost: number
  totalProjects: number
  totalTasks: number
  projects: ProjectCostStats[]
}

type ProjectWithCostTree = NonNullable<
  Awaited<ReturnType<StatsRepository['findProjectForCostStats']>>
>

function buildProjectCostStats(
  project: ProjectWithCostTree,
  imageCost: number,
  recentSlice: number
): ProjectCostStats {
  const tasks = project.episodes.flatMap(e => e.scenes.flatMap(s => s.takes))
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const failedTasks = tasks.filter(t => t.status === 'failed')

  const wanTasks = completedTasks.filter(t => t.model === 'wan2.6')
  const seedanceTasks = completedTasks.filter(t => t.model === 'seedance2.0')

  const videoCost = completedTasks.reduce((sum, t) => sum + (t.cost || 0), 0)
  const aiCost = project.importTasks.reduce((sum, t) => {
    const result = t.result as { aiCost?: number } | null
    return sum + (result?.aiCost || 0)
  }, 0)

  return {
    projectId: project.id,
    projectName: project.name,
    totalCost: videoCost + aiCost + imageCost,
    aiCost,
    videoCost,
    imageCost,
    totalTasks: tasks.length,
    completedTasks: completedTasks.length,
    failedTasks: failedTasks.length,
    tasksByModel: {
      wan2dot6: {
        count: wanTasks.length,
        cost: wanTasks.reduce((sum, t) => sum + (t.cost || 0), 0)
      },
      seedance2dot0: {
        count: seedanceTasks.length,
        cost: seedanceTasks.reduce((sum, t) => sum + (t.cost || 0), 0)
      }
    },
    recentTasks: tasks
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, recentSlice)
      .map(t => ({
        id: t.id,
        model: t.model,
        cost: t.cost || 0,
        status: t.status,
        createdAt: t.createdAt
      }))
  }
}

export type DailyCostRow = {
  date: string
  wanCost: number
  seedanceCost: number
  imageCost: number
  total: number
}

export class StatsService {
  constructor(private readonly repo: StatsRepository) {}

  async getProjectCostStats(projectId: string): Promise<ProjectCostStats | null> {
    const project = await this.repo.findProjectForCostStats(projectId)
    if (!project) return null

    const imageCost = await this.repo.sumImageCostForProject(project.id)
    return buildProjectCostStats(project, imageCost, 10)
  }

  async getUserCostStats(userId: string): Promise<UserCostStats> {
    const projects = await this.repo.findManyProjectsForUserCostStats(userId)

    const allTasks = projects.flatMap(p =>
      p.episodes.flatMap(e => e.scenes.flatMap(s => s.takes))
    )
    const completedTasks = allTasks.filter(t => t.status === 'completed')

    const projectStats: ProjectCostStats[] = await Promise.all(
      projects.map(async project => {
        const imageCost = await this.repo.sumImageCostForProject(project.id)
        return buildProjectCostStats(project, imageCost, 5)
      })
    )

    const totalVideoCost = completedTasks.reduce((sum, t) => sum + (t.cost || 0), 0)
    const totalAiCost = projects.reduce((sum, p) => {
      return (
        sum +
        p.importTasks.reduce((s, t) => {
          const result = t.result as { aiCost?: number } | null
          return s + (result?.aiCost || 0)
        }, 0)
      )
    }, 0)
    const totalImageCost = projectStats.reduce((sum, p) => sum + p.imageCost, 0)

    return {
      userId,
      totalCost: totalVideoCost + totalAiCost + totalImageCost,
      aiCost: totalAiCost,
      videoCost: totalVideoCost,
      imageCost: totalImageCost,
      totalProjects: projects.length,
      totalTasks: allTasks.length,
      projects: projectStats.sort((a, b) => b.totalCost - a.totalCost)
    }
  }

  async getCostTrend(
    userId: string,
    projectId: string | undefined,
    days: number
  ): Promise<DailyCostRow[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const whereClause: Record<string, unknown> = {
      status: 'completed',
      cost: { not: null },
      createdAt: { gte: startDate }
    }

    if (projectId) {
      whereClause.scene = {
        episode: {
          projectId
        }
      }
    } else {
      whereClause.scene = {
        episode: {
          project: {
            userId
          }
        }
      }
    }

    const tasks = await this.repo.findTakesForTrend(whereClause as never)

    const imageWhereChar = {
      imageCost: { not: null } as const,
      updatedAt: { gte: startDate },
      character: projectId
        ? { projectId }
        : { project: { userId } }
    }
    const imageWhereLoc = {
      imageCost: { not: null } as const,
      updatedAt: { gte: startDate },
      ...(projectId ? { projectId } : { project: { userId } })
    }

    const [charImageRows, locationRows] = await Promise.all([
      this.repo.findCharacterImagesForTrend(imageWhereChar),
      this.repo.findLocationsForTrend(imageWhereLoc)
    ])

    const dailyCosts = new Map<string, DailyCostRow>()

    const ensureDay = (date: string) => {
      if (!dailyCosts.has(date)) {
        dailyCosts.set(date, { date, wanCost: 0, seedanceCost: 0, imageCost: 0, total: 0 })
      }
      return dailyCosts.get(date)!
    }

    tasks.forEach(task => {
      const date = task.createdAt.toISOString().split('T')[0]
      const day = ensureDay(date)
      if (task.cost) {
        if (task.model === 'wan2.6') {
          day.wanCost += task.cost
        } else {
          day.seedanceCost += task.cost
        }
        day.total += task.cost
      }
    })

    for (const row of charImageRows) {
      if (row.imageCost == null) continue
      const date = row.updatedAt.toISOString().split('T')[0]
      const day = ensureDay(date)
      day.imageCost += row.imageCost
      day.total += row.imageCost
    }
    for (const row of locationRows) {
      if (row.imageCost == null) continue
      const date = row.updatedAt.toISOString().split('T')[0]
      const day = ensureDay(date)
      day.imageCost += row.imageCost
      day.total += row.imageCost
    }

    return Array.from(dailyCosts.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  async getAiBalance() {
    try {
      const balance = await getDeepSeekBalance()
      return balance
    } catch (error) {
      console.error('Failed to get DeepSeek balance:', error)
      return { isAvailable: false, balanceInfos: [], error: 'Failed to fetch balance' }
    }
  }
}

export const statsRepository = new StatsRepository(prisma)
export const statsService = new StatsService(statsRepository)
