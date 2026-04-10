import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'

export interface ProjectCostStats {
  projectId: string
  projectName: string
  totalCost: number
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
  totalProjects: number
  totalTasks: number
  projects: ProjectCostStats[]
}

export async function statsRoutes(fastify: FastifyInstance) {
  // Get cost statistics for a project
  fastify.get<{ Querystring: { projectId: string } }>(
    '/projects/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.query

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          episodes: {
            include: {
              scenes: {
                include: {
                  tasks: true
                }
              }
            }
          }
        }
      })

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      const tasks = project.episodes.flatMap(e => e.scenes.flatMap(s => s.tasks))

      const completedTasks = tasks.filter(t => t.status === 'completed')
      const failedTasks = tasks.filter(t => t.status === 'failed')

      const wanTasks = completedTasks.filter(t => t.model === 'wan2.6')
      const seedanceTasks = completedTasks.filter(t => t.model === 'seedance2.0')

      const stats: ProjectCostStats = {
        projectId: project.id,
        projectName: project.name,
        totalCost: completedTasks.reduce((sum, t) => sum + (t.cost || 0), 0),
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
          .slice(0, 10)
          .map(t => ({
            id: t.id,
            model: t.model,
            cost: t.cost || 0,
            status: t.status,
            createdAt: t.createdAt
          }))
      }

      return stats
    }
  )

  // Get cost statistics for current user (all projects)
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = (request as any).user

      const projects = await prisma.project.findMany({
        where: { userId: user.id },
        include: {
          episodes: {
            include: {
              scenes: {
                include: {
                  tasks: true
                }
              }
            }
          }
        }
      })

      const allTasks = projects.flatMap(p =>
        p.episodes.flatMap(e => e.scenes.flatMap(s => s.tasks))
      )
      const completedTasks = allTasks.filter(t => t.status === 'completed')

      const projectStats: ProjectCostStats[] = projects.map(project => {
        const tasks = project.episodes.flatMap(e => e.scenes.flatMap(s => s.tasks))
        const completed = tasks.filter(t => t.status === 'completed')
        const failed = tasks.filter(t => t.status === 'failed')
        const wanTasks = completed.filter(t => t.model === 'wan2.6')
        const seedanceTasks = completed.filter(t => t.model === 'seedance2.0')

        return {
          projectId: project.id,
          projectName: project.name,
          totalCost: completed.reduce((sum, t) => sum + (t.cost || 0), 0),
          totalTasks: tasks.length,
          completedTasks: completed.length,
          failedTasks: failed.length,
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
            .slice(0, 5)
            .map(t => ({
              id: t.id,
              model: t.model,
              cost: t.cost || 0,
              status: t.status,
              createdAt: t.createdAt
            }))
        }
      })

      const stats: UserCostStats = {
        userId: user.id,
        totalCost: completedTasks.reduce((sum, t) => sum + (t.cost || 0), 0),
        totalProjects: projects.length,
        totalTasks: allTasks.length,
        projects: projectStats.sort((a, b) => b.totalCost - a.totalCost)
      }

      return stats
    }
  )

  // Get daily cost trend
  fastify.get<{ Querystring: { projectId?: string; days?: number } }>(
    '/trend',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = (request as any).user
      const { projectId, days = 30 } = request.query

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const whereClause: any = {
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
              userId: user.id
            }
          }
        }
      }

      const tasks = await prisma.videoTask.findMany({
        where: whereClause,
        select: {
          cost: true,
          createdAt: true,
          model: true
        },
        orderBy: { createdAt: 'asc' }
      })

      // Group by day
      const dailyCosts = new Map<string, { date: string; wanCost: number; seedanceCost: number; total: number }>()

      tasks.forEach(task => {
        const date = task.createdAt.toISOString().split('T')[0]
        if (!dailyCosts.has(date)) {
          dailyCosts.set(date, { date, wanCost: 0, seedanceCost: 0, total: 0 })
        }
        const day = dailyCosts.get(date)!
        if (task.cost) {
          if (task.model === 'wan2.6') {
            day.wanCost += task.cost
          } else {
            day.seedanceCost += task.cost
          }
          day.total += task.cost
        }
      })

      return Array.from(dailyCosts.values())
    }
  )
}
