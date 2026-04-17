import { FastifyInstance } from 'fastify'
import { verifyProjectOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { importRouteService } from '../services/import-route-service.js'

export async function importRoutes(fastify: FastifyInstance) {
  // 预览解析结果（不保存到数据库）
  fastify.post<{
    Body: {
      content: string
      type: 'markdown' | 'json'
    }
  }>('/preview', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { content, type } = request.body

    const userId = (request as { user: { id: string } }).user.id
    const result = await importRouteService.previewImport(userId, content, type)

    if (!result.ok) {
      return reply.status(result.status).send({
        error: result.error,
        ...(result.message ? { message: result.message } : {})
      })
    }

    return {
      success: true,
      preview: result.preview,
      aiCost: result.aiCost
    }
  })
  // 导入剧本文档到已有项目（异步任务）
  fastify.post<{
    Body: {
      projectId: string
      content: string
      type: 'markdown' | 'json'
    }
  }>('/script', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.id
    const { projectId, content, type } = request.body

    if (!projectId || !content) {
      return reply.status(400).send({ error: '缺少必要参数' })
    }

    if (!(await verifyProjectOwnership(userId, projectId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    const { taskId, status } = await importRouteService.enqueueScriptImport(
      userId,
      projectId,
      content,
      type
    )

    return {
      success: true,
      taskId,
      status
    }
  })

  // 一键导入：创建新项目并导入剧本（异步任务）
  fastify.post<{
    Body: {
      content: string
      type: 'markdown' | 'json'
    }
  }>('/project', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.id
    const { content, type } = request.body

    if (!content) {
      return reply.status(400).send({ error: '缺少必要参数' })
    }

    const { taskId, status } = await importRouteService.enqueueProjectImport(userId, content, type)

    return {
      success: true,
      taskId,
      status
    }
  })

  // 获取导入任务状态
  fastify.get<{
    Params: { id: string }
  }>('/task/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.id
    const taskId = request.params.id

    const task = await importRouteService.getImportTask(taskId)

    if (!task) {
      return reply.status(404).send({ error: '任务不存在' })
    }

    if (task.userId !== userId) {
      return reply.status(403).send(permissionDeniedBody)
    }

    return task
  })

  // 获取用户所有导入任务列表
  fastify.get<{
    Querystring: { limit?: number; offset?: number }
  }>('/tasks', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.id
    const limit = request.query.limit || 50
    const offset = request.query.offset || 0

    return importRouteService.listImportTasks(userId, limit, offset)
  })
}
