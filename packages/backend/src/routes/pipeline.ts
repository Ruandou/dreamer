/**
 * Pipeline 路由
 * AI 短剧生产流水线 API - 异步 Job 模式
 */

import { FastifyInstance } from 'fastify'
import { pipelineRouteService } from '../services/pipeline-route-service.js'
import { getRequestUserId } from '../plugins/auth.js'

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
  }>(
    '/execute',
    {
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
      const userId = getRequestUserId(request)

      const result = await pipelineRouteService.createAndStartFullPipeline(userId, request.body)

      if (!result.ok) {
        return reply
          .status(result.status)
          .send(
            result.status === 500
              ? { success: false, error: result.error }
              : { error: result.error }
          )
      }

      return {
        success: true,
        data: {
          jobId: result.jobId,
          status: 'pending',
          message: 'Pipeline 已创建，正在后台执行'
        }
      }
    }
  )

  // 获取 Job 状态
  fastify.get<{
    Params: { jobId: string }
  }>(
    '/job/:jobId',
    {
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { jobId } = request.params

      const result = await pipelineRouteService.getJobDetail(userId, jobId)
      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }

      return {
        success: true,
        data: result.data
      }
    }
  )

  // 获取项目的最新 Job 状态
  fastify.get<{
    Params: { projectId: string }
  }>(
    '/status/:projectId',
    {
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { projectId } = request.params

      const result = await pipelineRouteService.getProjectPipelineStatus(userId, projectId)
      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }

      return {
        success: true,
        data: result.data
      }
    }
  )

  // 获取流水线步骤列表
  fastify.get(
    '/steps',
    {
      preHandler: [fastify.authenticate]
    },
    async () => {
      return pipelineRouteService.getStepsCatalog()
    }
  )

  // 获取用户所有 Pipeline Jobs
  fastify.get(
    '/jobs',
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      const userId = getRequestUserId(request)
      return pipelineRouteService.listJobsForUser(userId)
    }
  )

  // 取消 Job
  fastify.delete<{
    Params: { jobId: string }
  }>(
    '/job/:jobId',
    {
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { jobId } = request.params

      const result = await pipelineRouteService.cancelJob(userId, jobId)
      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }

      return { success: true, message: 'Job 已取消' }
    }
  )
}
