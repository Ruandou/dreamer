import { FastifyInstance } from 'fastify'
import { getRequestUserId } from '../plugins/auth.js'
import { prisma } from '../lib/prisma.js'
import { takeRepository } from '../repositories/take-repository.js'
import { importRepository } from '../repositories/import-repository.js'
import { pipelineRepository } from '../repositories/pipeline-repository.js'
import { listImageGenerationJobsForUser } from '../services/image-generation-job-service.js'

export interface UnifiedJob {
  id: string
  type: 'video' | 'import' | 'pipeline' | 'image'
  status: string
  createdAt: string
  updatedAt: string
  // Common fields
  projectId?: string | null
  projectName?: string | null
  // video fields
  sceneId?: string
  sceneNum?: number
  segmentDescription?: string | null
  model?: string
  videoUrl?: string
  thumbnailUrl?: string
  cost?: number
  duration?: number
  prompt?: string
  // import fields
  content?: string
  contentPreview?: string
  result?: unknown
  errorMsg?: string
  // pipeline fields
  jobType?: string
  currentStep?: string
  progress?: number
  progressMeta?: unknown
  stepResults?: unknown[]
  // image fields
  kind?: string
  characterId?: string
  characterImageId?: string
  locationId?: string
  returnvalue?: unknown
}

/**
 * 统一任务查询接口
 * 聚合视频生成、剧本导入、Pipeline、图片生成四类任务
 */
export async function tasksUnifiedRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: {
      type?: string
      status?: string
      limit?: number
      offset?: number
    }
  }>('/all', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = getRequestUserId(request)
    const { type, status } = request.query
    const rawLimit = request.query.limit ?? 200
    const rawOffset = request.query.offset ?? 0
    const limit = Math.min(Math.max(1, rawLimit), 1000)
    const offset = Math.max(0, rawOffset)

    const jobs: UnifiedJob[] = []

    // 并行查询各类任务
    const [videoTasks, importTasks, pipelineJobs, imageJobs] = await Promise.all([
      // 1. 视频生成任务 (Take)
      !type || type === 'video' ? takeRepository.findAllForUser(userId) : Promise.resolve([]),

      // 2. 剧本导入任务 (ImportTask)
      !type || type === 'import'
        ? importRepository.findManyForUser(userId, limit, offset)
        : Promise.resolve([]),

      // 3. Pipeline 任务
      !type || type === 'pipeline'
        ? pipelineRepository.findManyJobsForUser(userId)
        : Promise.resolve([]),

      // 4. 图片生成任务 (BullMQ)
      !type || type === 'image' ? listImageGenerationJobsForUser(userId) : Promise.resolve([])
    ])

    // 获取所有相关项目名（用于补充 projectName）
    const projectIds = new Set<string>()
    for (const t of videoTasks) {
      if (t.scene?.episode?.projectId) projectIds.add(t.scene.episode.projectId)
    }
    for (const j of pipelineJobs) {
      if (j.projectId) projectIds.add(j.projectId)
    }
    for (const j of imageJobs) {
      if (j.projectId) projectIds.add(j.projectId)
    }

    const projects =
      projectIds.size > 0
        ? await prisma.project.findMany({
            where: { id: { in: Array.from(projectIds) } },
            select: { id: true, name: true }
          })
        : []
    const projectNameById = new Map(projects.map((p) => [p.id, p.name]))

    // 转换视频任务
    for (const task of videoTasks) {
      const projectId = task.scene?.episode?.projectId
      const job: UnifiedJob = {
        id: task.id,
        type: 'video',
        status: task.status,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        projectId: projectId || undefined,
        projectName: projectId ? projectNameById.get(projectId) || null : null,
        sceneId: task.sceneId,
        sceneNum: task.scene?.sceneNum,
        segmentDescription: task.scene?.description,
        model: task.model || undefined,
        videoUrl: task.videoUrl || undefined,
        thumbnailUrl: task.thumbnailUrl || undefined,
        cost: task.cost || undefined,
        duration: task.duration || undefined,
        prompt: task.prompt || undefined
      }
      jobs.push(job)
    }

    // 转换导入任务
    for (const task of importTasks) {
      const job: UnifiedJob = {
        id: task.id,
        type: 'import',
        status: task.status,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        projectId: task.projectId || undefined,
        content: task.content || undefined,
        contentPreview: task.content
          ? task.content.slice(0, 60) + (task.content.length > 60 ? '...' : '')
          : undefined,
        result: (task.result as unknown) || undefined,
        errorMsg: task.errorMsg || undefined
      }
      jobs.push(job)
    }

    // 转换 Pipeline 任务（统一状态命名：running → processing）
    for (const job of pipelineJobs) {
      const normalizedStatus = job.status === 'running' ? 'processing' : (job.status as string)
      const j: UnifiedJob = {
        id: job.id,
        type: 'pipeline',
        status: normalizedStatus,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        projectId: job.projectId,
        projectName: job.project?.name || null,
        jobType: job.jobType || undefined,
        currentStep: job.currentStep || undefined,
        progress: job.progress || undefined,
        progressMeta: job.progressMeta || undefined,
        stepResults: job.stepResults || undefined,
        errorMsg: job.error || undefined
      }
      jobs.push(j)
    }

    // 转换图片任务
    for (const job of imageJobs) {
      const j: UnifiedJob = {
        id: job.id,
        type: 'image',
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        projectId: job.projectId,
        projectName: projectNameById.get(job.projectId) || null,
        kind: job.kind,
        characterId: job.characterId || undefined,
        characterImageId: job.characterImageId || undefined,
        locationId: job.locationId || undefined,
        returnvalue: job.returnvalue,
        errorMsg: job.errorMsg || undefined
      }
      jobs.push(j)
    }

    // 按创建时间排序
    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // 状态过滤
    let filtered = jobs
    if (status) {
      filtered = jobs.filter((j) => j.status === status)
    }

    // 分页
    const total = filtered.length
    const paginated = filtered.slice(offset, offset + limit)

    return {
      jobs: paginated,
      total,
      limit,
      offset
    }
  })
}
