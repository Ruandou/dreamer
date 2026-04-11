/**
 * Pipeline 路由
 * AI 短剧生产流水线 API - 异步 Job 模式
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { executePipelineJob } from '../services/pipeline-executor.js'
import type { PipelineStep } from '@dreamer/shared/types'

export async function pipelineRoutes(fastify: FastifyInstance) {

  // 创建 Pipeline Job
  fastify.post<{
    Body: {
      projectId: string
      idea: string
      targetEpisodes?: number
      targetDuration?: number
      defaultAspectRatio?: '16:9' | '9:16' | '1:1'
      defaultResolution?: '480p' | '720p'
    }
  }>('/execute', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = (request as any).user.id
    const { projectId, idea, targetEpisodes, targetDuration, defaultAspectRatio, defaultResolution } = request.body

    if (!projectId || !idea) {
      return reply.status(400).send({ error: '缺少必要参数: projectId, idea' })
    }

    try {
      // 验证项目存在且属于当前用户
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId }
      })

      if (!project) {
        return reply.status(404).send({ error: '项目不存在' })
      }

      // 创建 PipelineJob
      const job = await prisma.pipelineJob.create({
        data: {
          projectId,
          status: 'pending',
          currentStep: 'script-writing',
          progress: 0
        }
      })

      // 创建初始步骤记录
      await prisma.pipelineStepResult.createMany({
        data: [
          { jobId: job.id, step: 'script-writing', status: 'pending' },
          { jobId: job.id, step: 'episode-split', status: 'pending' },
          { jobId: job.id, step: 'segment-extract', status: 'pending' },
          { jobId: job.id, step: 'storyboard', status: 'pending' }
        ]
      })

      // 异步执行 Pipeline（不阻塞 HTTP 响应）
      executePipelineJob(job.id, {
        projectId,
        idea,
        targetEpisodes,
        targetDuration,
        defaultAspectRatio: defaultAspectRatio || '9:16',
        defaultResolution: defaultResolution || '720p'
      }).catch(error => {
        console.error(`Pipeline Job ${job.id} failed:`, error)
      })

      return {
        success: true,
        data: {
          jobId: job.id,
          status: 'pending',
          message: 'Pipeline 已创建，正在后台执行'
        }
      }
    } catch (error) {
      console.error('Failed to create pipeline job:', error)
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : '创建 Pipeline 失败'
      })
    }
  })

  // 获取 Job 状态
  fastify.get<{
    Params: { jobId: string }
  }>('/job/:jobId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = (request as any).user.id
    const { jobId } = request.params

    const job = await prisma.pipelineJob.findUnique({
      where: { id: jobId },
      include: {
        stepResults: true
      }
    })

    if (!job) {
      return reply.status(404).send({ error: 'Job 不存在' })
    }

    // 验证项目属于当前用户
    const project = await prisma.project.findFirst({
      where: { id: job.projectId, userId }
    })

    if (!project) {
      return reply.status(404).send({ error: 'Job 不存在' })
    }

    return {
      success: true,
      data: {
        id: job.id,
        projectId: job.projectId,
        status: job.status,
        currentStep: job.currentStep,
        progress: job.progress,
        error: job.error,
        stepResults: job.stepResults,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    }
  })

  // 获取项目的最新 Job 状态
  fastify.get<{
    Params: { projectId: string }
  }>('/status/:projectId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = (request as any).user.id
    const { projectId } = request.params

    // 验证项目
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    })

    if (!project) {
      return reply.status(404).send({ error: '项目不存在' })
    }

    // 获取项目的最新 Job
    const job = await prisma.pipelineJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        stepResults: true
      }
    })

    if (!job) {
      return {
        success: true,
        data: { status: 'not_started' }
      }
    }

    return {
      success: true,
      data: {
        id: job.id,
        status: job.status,
        currentStep: job.currentStep,
        progress: job.progress,
        error: job.error,
        stepResults: job.stepResults
      }
    }
  })

  // 获取流水线步骤列表
  fastify.get('/steps', {
    preHandler: [fastify.authenticate]
  }, async () => {
    return {
      steps: [
        { id: 'script-writing', description: '剧本生成 - 使用 DeepSeek AI 从想法生成专业剧本' },
        { id: 'episode-split', description: '智能分集 - 将剧本按起承转合结构分割成多集' },
        { id: 'segment-extract', description: '分镜提取 - 提取角色、场景和动作' },
        { id: 'storyboard', description: '分镜生成 - 生成带提示词的分镜片段' }
      ]
    }
  })

  // 获取用户所有 Pipeline Jobs
  fastify.get('/jobs', {
    preHandler: [fastify.authenticate]
  }, async (request) => {
    const userId = (request as any).user.id

    const jobs = await prisma.pipelineJob.findMany({
      where: {
        project: { userId }
      },
      include: {
        project: { select: { id: true, name: true } },
        stepResults: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return jobs.map(job => ({
      id: job.id,
      projectId: job.projectId,
      projectName: job.project?.name,
      status: job.status,
      currentStep: job.currentStep,
      progress: job.progress,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }))
  })

  // 取消 Job
  fastify.delete<{
    Params: { jobId: string }
  }>('/job/:jobId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = (request as any).user.id
    const { jobId } = request.params

    const job = await prisma.pipelineJob.findUnique({
      where: { id: jobId }
    })

    if (!job) {
      return reply.status(404).send({ error: 'Job 不存在' })
    }

    // 验证项目属于当前用户
    const project = await prisma.project.findFirst({
      where: { id: job.projectId, userId }
    })

    if (!project) {
      return reply.status(404).send({ error: 'Job 不存在' })
    }

    if (job.status === 'running') {
      return reply.status(400).send({ error: '无法取消正在运行的 Job' })
    }

    await prisma.pipelineJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: '用户取消' }
    })

    return { success: true, message: 'Job 已取消' }
  })
}
