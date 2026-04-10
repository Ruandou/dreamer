import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { verifyProjectOwnership } from '../plugins/auth.js'
import { importQueue } from '../queues/import.js'
import { parseScriptDocument } from '../services/parser.js'

export async function importRoutes(fastify: FastifyInstance) {
  // 预览解析结果（不保存到数据库）
  fastify.post<{
    Body: {
      content: string
      type: 'markdown' | 'json'
    }
  }>(
    '/preview',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { content, type } = request.body

      if (!content) {
        return reply.status(400).send({ error: '缺少必要参数' })
      }

      try {
        const { parsed, cost } = await parseScriptDocument(content, type)

        return {
          success: true,
          preview: {
            projectName: parsed.projectName,
            description: parsed.description,
            characters: parsed.characters,
            episodes: parsed.episodes.map(ep => ({
              episodeNum: ep.episodeNum,
              title: ep.title,
              sceneCount: ep.scenes.length,
              scenes: ep.scenes.slice(0, 3).map(s => ({
                sceneNum: s.sceneNum,
                description: s.description.slice(0, 100) + (s.description.length > 100 ? '...' : '')
              }))
            }))
          },
          aiCost: cost?.costCNY || 0
        }
      } catch (error) {
        console.error('Preview failed:', error)
        return reply.status(400).send({
          error: '解析预览失败',
          message: error instanceof Error ? error.message : '未知错误'
        })
      }
    }
  )
  // 导入剧本文档到已有项目（异步任务）
  fastify.post<{
    Body: {
      projectId: string
      content: string
      type: 'markdown' | 'json'
    }
  }>(
    '/script',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId, content, type } = request.body

      if (!projectId || !content) {
        return reply.status(400).send({ error: '缺少必要参数' })
      }

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not own this project' })
      }

      // 创建导入任务
      const task = await prisma.importTask.create({
        data: {
          userId,
          projectId,
          content,
          type,
          status: 'pending'
        }
      })

      // 加入队列
      await importQueue.add('import-script', {
        taskId: task.id,
        projectId,
        userId,
        content,
        type
      })

      return {
        success: true,
        taskId: task.id,
        status: 'pending'
      }
    }
  )

  // 一键导入：创建新项目并导入剧本（异步任务）
  fastify.post<{
    Body: {
      content: string
      type: 'markdown' | 'json'
    }
  }>(
    '/project',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { content, type } = request.body

      if (!content) {
        return reply.status(400).send({ error: '缺少必要参数' })
      }

      // 创建导入任务（projectId 稍后由 worker 更新）
      const task = await prisma.importTask.create({
        data: {
          userId,
          content,
          type,
          status: 'pending'
        }
      })

      // 加入队列
      await importQueue.add('import-project', {
        taskId: task.id,
        userId,
        content,
        type
      })

      return {
        success: true,
        taskId: task.id,
        status: 'pending'
      }
    }
  )

  // 获取导入任务状态
  fastify.get<{
    Params: { id: string }
  }>(
    '/task/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const taskId = request.params.id

      const task = await prisma.importTask.findUnique({
        where: { id: taskId }
      })

      if (!task) {
        return reply.status(404).send({ error: '任务不存在' })
      }

      if (task.userId !== userId) {
        return reply.status(403).send({ error: '无权限访问此任务' })
      }

      return task
    }
  )

  // 获取用户所有导入任务列表
  fastify.get<{
    Querystring: { limit?: number; offset?: number }
  }>(
    '/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const limit = request.query.limit || 50
      const offset = request.query.offset || 0

      const tasks = await prisma.importTask.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      })

      const total = await prisma.importTask.count({
        where: { userId }
      })

      return { tasks, total }
    }
  )
}

async function importParsedData(projectId: string, parsed: ParsedScript) {
  const results = {
    episodesCreated: 0,
    episodesUpdated: 0,
    charactersCreated: 0,
    scenesCreated: 0
  }

  // 创建角色
  const characterMap = new Map<string, string>()
  for (const charName of parsed.characters) {
    const char = await prisma.character.create({
      data: {
        projectId,
        name: charName,
        description: `从剧本导入的角色: ${charName}`
      }
    })
    characterMap.set(charName, char.id)
    results.charactersCreated++
  }

  // 创建/更新集数
  for (const episodeData of parsed.episodes) {
    // 查找是否已存在该集
    const existing = await prisma.episode.findFirst({
      where: {
        projectId,
        episodeNum: episodeData.episodeNum
      },
      include: { scenes: true }
    })

    if (existing) {
      // 更新现有集数
      await prisma.episode.update({
        where: { id: existing.id },
        data: {
          title: episodeData.title,
          script: episodeData.script as any
        }
      })

      // 删除旧场景并创建新场景
      await prisma.scene.deleteMany({ where: { episodeId: existing.id } })

      for (const scene of episodeData.scenes) {
        await prisma.scene.create({
          data: {
            episodeId: existing.id,
            sceneNum: scene.sceneNum,
            description: scene.description,
            prompt: scene.prompt
          }
        })
        results.scenesCreated++
      }

      results.episodesUpdated++
    } else {
      // 创建新集数
      const episode = await prisma.episode.create({
        data: {
          projectId,
          episodeNum: episodeData.episodeNum,
          title: episodeData.title,
          script: episodeData.script as any
        }
      })

      // 创建场景
      for (const scene of episodeData.scenes) {
        await prisma.scene.create({
          data: {
            episodeId: episode.id,
            sceneNum: scene.sceneNum,
            description: scene.description,
            prompt: scene.prompt
          }
        })
        results.scenesCreated++
      }

      results.episodesCreated++
    }
  }

  return results
}

interface ParsedScript {
  projectName?: string
  description?: string
  characters: string[]
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