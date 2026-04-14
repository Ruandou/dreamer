import { FastifyInstance } from 'fastify'
import { projectService } from '../services/project-service.js'

export async function projectRoutes(fastify: FastifyInstance) {
  // List projects
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = (request as any).user
      return projectService.listProjects(user.id)
    }
  )

  // Create project
  fastify.post<{
    Body: { name: string; description?: string; aspectRatio?: string }
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const { name, description, aspectRatio } = request.body

      const project = await projectService.createProject(user.id, {
        name,
        description,
        aspectRatio
      })

      return reply.status(201).send(project)
    }
  )

  // 生成第一集（须注册在 GET /:id 之前，避免被误匹配）
  fastify.post<{
    Params: { id: string }
    Body: { description?: string }
  }>(
    '/:id/episodes/generate-first',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const projectId = request.params.id
      const { description } = request.body || {}

      const result = await projectService.generateFirstEpisode(user.id, projectId, {
        description
      })

      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }

      return {
        episode: result.episode,
        synopsis: result.synopsis
      }
    }
  )

  // 批量生成剩余集（异步）
  fastify.post<{
    Params: { id: string }
    Body: { targetEpisodes?: number }
  }>(
    '/:id/episodes/generate-remaining',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const projectId = request.params.id
      const targetEpisodes = request.body?.targetEpisodes

      const result = await projectService.generateRemainingEpisodes(
        user.id,
        projectId,
        targetEpisodes
      )

      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }

      return {
        jobId: result.jobId,
        status: 'processing',
        targetEpisodes: result.targetEpisodes,
        message: '任务已启动'
      }
    }
  )

  // 解析剧本：实体 + 形象槽位 + 分集概要（异步）
  fastify.post<{
    Params: { id: string }
    Body: { targetEpisodes?: number }
  }>(
    '/:id/parse',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const projectId = request.params.id
      const targetEpisodes = request.body?.targetEpisodes

      const result = await projectService.parseScript(user.id, projectId, targetEpisodes)

      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }

      return {
        jobId: result.jobId,
        status: 'processing',
        message: '解析任务已启动'
      }
    }
  )

  /** 大纲页：是否有进行中的第一集 / 批量 / 解析任务（刷新后恢复互斥与轮询） */
  fastify.get<{ Params: { id: string } }>(
    '/:id/outline-active-job',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const projectId = request.params.id

      const result = await projectService.getOutlineActiveJob(user.id, projectId)
      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }
      if (!result.job) {
        return { job: null }
      }
      return { job: result.job }
    }
  )

  // Get project（动态 :id 放在所有静态 GET 之后）
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const project = await projectService.getProjectDetail(user.id, request.params.id)

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      return project
    }
  )

  async function handleProjectUpdate(
    request: { params: { id: string }; body: Record<string, unknown> },
    reply: import('fastify').FastifyReply
  ) {
    const user = (request as any).user as { id: string }
    const { name, description, synopsis, visualStyle, aspectRatio } = request.body as {
      name?: string
      description?: string
      synopsis?: string | null
      visualStyle?: string[]
      aspectRatio?: string
    }

    const result = await projectService.updateProject(user.id, request.params.id, {
      name,
      description,
      synopsis,
      visualStyle,
      aspectRatio
    })

    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }

    return result.project
  }

  // Update project
  fastify.put<{
    Params: { id: string }
    Body: {
      name?: string
      description?: string
      synopsis?: string | null
      visualStyle?: string[]
      aspectRatio?: string
    }
  }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => handleProjectUpdate(request, reply)
  )

  fastify.patch<{
    Params: { id: string }
    Body: {
      name?: string
      description?: string
      synopsis?: string | null
      visualStyle?: string[]
      aspectRatio?: string
    }
  }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => handleProjectUpdate(request, reply)
  )

  // Delete project
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user

      const deleted = await projectService.deleteProject(user.id, request.params.id)
      if (!deleted) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      return reply.status(204).send()
    }
  )
}
