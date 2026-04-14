import { FastifyInstance, FastifyReply } from 'fastify'
import { prisma } from '../index.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import {
  runGenerateFirstEpisodePipelineJob,
  runScriptBatchJob,
  runParseScriptJob,
  DEFAULT_TARGET_EPISODES,
  hasConcurrentOutlinePipelineJob,
  getActiveOutlinePipelineJob
} from '../services/project-script-jobs.js'
import { normalizeProjectDefaultAspectRatio } from '../lib/project-aspect.js'

export async function projectRoutes(fastify: FastifyInstance) {
  // List projects
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = (request as any).user
      return prisma.project.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        // 仅用于列表判断是否已解析（有角色）：take 1，避免拉全量角色
        include: {
          characters: { take: 1, select: { id: true } }
        }
      })
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

      const project = await prisma.project.create({
        data: {
          name,
          description,
          userId: user.id,
          ...(aspectRatio !== undefined && {
            aspectRatio: normalizeProjectDefaultAspectRatio(aspectRatio)
          })
        }
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

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id }
      })
      if (!project) {
        return reply.status(404).send({ error: '项目不存在' })
      }

      if (description?.trim()) {
        await prisma.project.update({
          where: { id: projectId },
          data: { description: description.trim() }
        })
      }

      if (await hasConcurrentOutlinePipelineJob(projectId)) {
        return reply.status(409).send({
          error: '已有剧本生成或解析任务进行中，请稍后再试'
        })
      }

      const job = await prisma.pipelineJob.create({
        data: {
          projectId,
          status: 'pending',
          jobType: 'script-first',
          currentStep: 'script-first',
          progress: 0
        }
      })

      try {
        await runGenerateFirstEpisodePipelineJob(job.id, projectId)
      } catch (e: any) {
        return reply.status(500).send({ error: e?.message || '生成第一集失败' })
      }

      const updated = await prisma.project.findUnique({
        where: { id: projectId },
        include: { episodes: { where: { episodeNum: 1 } } }
      })
      const ep1 = updated?.episodes[0]
      return {
        episode: ep1,
        synopsis: updated?.synopsis
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
      const targetEpisodes = request.body?.targetEpisodes ?? DEFAULT_TARGET_EPISODES

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id }
      })
      if (!project) {
        return reply.status(404).send({ error: '项目不存在' })
      }

      if (targetEpisodes < 2 || targetEpisodes > 200) {
        return reply.status(400).send({ error: 'targetEpisodes 须在 2–200 之间' })
      }

      const ep1 = await prisma.episode.findUnique({
        where: { projectId_episodeNum: { projectId, episodeNum: 1 } }
      })
      const rs = ep1?.rawScript as any
      if (!ep1 || !rs || !Array.isArray(rs.scenes) || rs.scenes.length === 0) {
        return reply.status(400).send({ error: '请先生成第一集剧本' })
      }

      if (await hasConcurrentOutlinePipelineJob(projectId)) {
        return reply.status(409).send({
          error: '已有剧本生成或解析任务进行中，请稍后再试'
        })
      }

      const job = await prisma.pipelineJob.create({
        data: {
          projectId,
          status: 'pending',
          jobType: 'script-batch',
          currentStep: 'script-batch',
          progress: 0
        }
      })

      void runScriptBatchJob(job.id, projectId, targetEpisodes).catch(err => {
        console.error('script-batch job failed', err)
      })

      return {
        jobId: job.id,
        status: 'processing',
        targetEpisodes,
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
      const targetEpisodes = request.body?.targetEpisodes ?? DEFAULT_TARGET_EPISODES

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
        include: { episodes: { where: { episodeNum: 1 } } }
      })
      if (!project) {
        return reply.status(404).send({ error: '项目不存在' })
      }

      if (!project.visualStyle?.length) {
        return reply.status(400).send({ error: '请至少选择一种视觉风格' })
      }

      const ep1 = project.episodes[0]
      const raw = ep1?.rawScript
      const scenes = raw && typeof raw === 'object' ? (raw as any).scenes : null
      if (!raw || typeof raw !== 'object' || !Array.isArray(scenes) || scenes.length === 0) {
        return reply.status(400).send({ error: '请先生成第一集剧本' })
      }

      if (await hasConcurrentOutlinePipelineJob(projectId)) {
        return reply.status(409).send({
          error: '已有剧本生成或解析任务进行中，请稍后再试'
        })
      }

      const job = await prisma.pipelineJob.create({
        data: {
          projectId,
          status: 'pending',
          jobType: 'parse-script',
          currentStep: 'parse-script',
          progress: 0
        }
      })

      void runParseScriptJob(job.id, projectId, targetEpisodes).catch(err => {
        console.error('parse-script job failed', err)
      })

      return {
        jobId: job.id,
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
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id }
      })
      if (!project) {
        return reply.status(404).send({ error: '项目不存在' })
      }
      const job = await getActiveOutlinePipelineJob(projectId)
      if (!job) {
        return { job: null }
      }
      return {
        job: {
          id: job.id,
          projectId: job.projectId,
          status: job.status,
          jobType: job.jobType,
          currentStep: job.currentStep,
          progress: job.progress,
          progressMeta: job.progressMeta,
          error: job.error,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt
        }
      }
    }
  )

  // Get project（动态 :id 放在所有静态 GET 之后）
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const project = await prisma.project.findFirst({
        where: { id: request.params.id, userId: user.id },
        include: {
          // 不 include DB Scene：分镜/任务走 /scenes；剧本正文在 episode.rawScript（JSON）
          episodes: true,
          characters: {
            include: {
              images: { orderBy: { order: 'asc' } }
            }
          },
          locations: { where: { deletedAt: null } },
          compositions: true
        }
      })

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      return project
    }
  )

  async function handleProjectUpdate(
    request: { params: { id: string }; body: Record<string, unknown> },
    reply: FastifyReply
  ) {
    const user = (request as any).user as { id: string }
    const { name, description, synopsis, visualStyle, aspectRatio } = request.body as {
      name?: string
      description?: string
      synopsis?: string | null
      visualStyle?: string[]
      aspectRatio?: string
    }

    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: user.id }
    })

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (synopsis !== undefined) data.synopsis = synopsis
    if (visualStyle !== undefined) {
      if (!Array.isArray(visualStyle)) {
        return reply.status(400).send({ error: 'visualStyle 须为字符串数组' })
      }
      data.visualStyle = visualStyle
    }
    if (aspectRatio !== undefined) {
      if (typeof aspectRatio !== 'string') {
        return reply.status(400).send({ error: 'aspectRatio 须为字符串' })
      }
      data.aspectRatio = normalizeProjectDefaultAspectRatio(aspectRatio)
    }

    if (Object.keys(data).length === 0) {
      return project
    }

    return prisma.project.update({
      where: { id: request.params.id },
      data
    })
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

      const project = await prisma.project.findFirst({
        where: { id: request.params.id, userId: user.id }
      })

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      await prisma.project.delete({ where: { id: request.params.id } })

      return reply.status(204).send()
    }
  )
}
