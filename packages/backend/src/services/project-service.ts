import type { Prisma, Project } from '@prisma/client'
import { normalizeProjectDefaultAspectRatio } from '../lib/project-aspect.js'
import { ProjectRepository, projectRepository } from '../repositories/project-repository.js'
import { pipelineRepository } from '../repositories/pipeline-repository.js'
import {
  runGenerateFirstEpisodePipelineJob,
  runScriptBatchJob,
  runParseScriptJob,
  DEFAULT_TARGET_EPISODES,
  hasConcurrentOutlinePipelineJob,
  getActiveOutlinePipelineJob
} from './project-script-jobs.js'
import type { VisualStyleConfig } from '@dreamer/shared'

export type CreateProjectInput = {
  name: string
  description?: string
  aspectRatio?: string
}

export type UpdateProjectBody = {
  name?: string
  description?: string
  synopsis?: string | null
  visualStyle?: string[]
  visualStyleConfig?: VisualStyleConfig | null
  aspectRatio?: string
}

export type GenerateFirstResult =
  | { ok: true; episode: unknown; synopsis: string | null | undefined }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 409; error: string }
  | { ok: false; status: 500; error: string }

export type GenerateRemainingResult =
  | { ok: true; jobId: string; targetEpisodes: number }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 409; error: string }

export type ParseScriptResult =
  | { ok: true; jobId: string }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 409; error: string }

export type UpdateProjectResult =
  | { ok: true; project: Project }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 404; error: string }

export class ProjectService {
  constructor(private readonly repo: ProjectRepository) {}

  listProjects(userId: string) {
    return this.repo.findManyByUserForList(userId)
  }

  createProject(userId: string, input: CreateProjectInput) {
    const { name, description, aspectRatio } = input
    return this.repo.create({
      name,
      description,
      userId,
      ...(aspectRatio !== undefined && {
        aspectRatio: normalizeProjectDefaultAspectRatio(aspectRatio)
      })
    })
  }

  async generateFirstEpisode(
    userId: string,
    projectId: string,
    body: { description?: string }
  ): Promise<GenerateFirstResult> {
    const project = await this.repo.findFirstOwned(projectId, userId)
    if (!project) {
      return { ok: false, status: 404, error: '项目不存在' }
    }

    const description = body?.description
    if (description?.trim()) {
      await this.repo.update(projectId, { description: description.trim() })
    }

    if (await hasConcurrentOutlinePipelineJob(projectId)) {
      return {
        ok: false,
        status: 409,
        error: '已有剧本生成或解析任务进行中，请稍后再试'
      }
    }

    const job = await this.repo.createPipelineJob({
      projectId,
      status: 'pending',
      jobType: 'script-first',
      currentStep: 'script-first',
      progress: 0
    })

    try {
      await runGenerateFirstEpisodePipelineJob(job.id, projectId)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, status: 500, error: message || '生成第一集失败' }
    }

    const updated = await this.repo.findUniqueWithEpisodesEp1(projectId)
    const ep1 = updated?.episodes[0]
    return {
      ok: true,
      episode: ep1,
      synopsis: updated?.synopsis
    }
  }

  async generateRemainingEpisodes(
    userId: string,
    projectId: string,
    targetEpisodes: number = DEFAULT_TARGET_EPISODES
  ): Promise<GenerateRemainingResult> {
    const project = await this.repo.findFirstOwned(projectId, userId)
    if (!project) {
      return { ok: false, status: 404, error: '项目不存在' }
    }

    if (targetEpisodes < 2 || targetEpisodes > 200) {
      return {
        ok: false,
        status: 400,
        error: 'targetEpisodes 须在 2–200 之间'
      }
    }

    const ep1 = await this.repo.findEpisode1ByProject(projectId)
    const rs = ep1?.script as { scenes?: unknown } | null
    if (!ep1 || !rs || !Array.isArray(rs.scenes) || rs.scenes.length === 0) {
      return { ok: false, status: 400, error: '请先生成第一集剧本' }
    }

    if (await hasConcurrentOutlinePipelineJob(projectId)) {
      return {
        ok: false,
        status: 409,
        error: '已有剧本生成或解析任务进行中，请稍后再试'
      }
    }

    const job = await this.repo.createPipelineJob({
      projectId,
      status: 'pending',
      jobType: 'script-batch',
      currentStep: 'script-batch',
      progress: 0
    })

    // 异步执行任务，不阻塞响应
    setImmediate(async () => {
      try {
        await runScriptBatchJob(job.id, projectId, targetEpisodes)
      } catch (err) {
        console.error('script-batch job failed', err)
        // 确保错误状态被更新到数据库
        try {
          await pipelineRepository.updateJob(job.id, {
            status: 'failed',
            error: err instanceof Error ? err.message : '批量生成失败',
            progressMeta: {
              message: err instanceof Error ? err.message : undefined
            }
          })
        } catch (updateErr) {
          console.error('Failed to update job status to failed', updateErr)
        }
      }
    })

    return { ok: true, jobId: job.id, targetEpisodes }
  }

  async parseScript(
    userId: string,
    projectId: string,
    targetEpisodes: number = DEFAULT_TARGET_EPISODES
  ): Promise<ParseScriptResult> {
    const project = await this.repo.findFirstOwnedWithEpisodesEp1(projectId, userId)
    if (!project) {
      return { ok: false, status: 404, error: '项目不存在' }
    }

    // visualStyleConfig 会在 runParseScriptJob 中自动生成，不需要前置检查

    const ep1 = project.episodes[0]
    const raw = ep1?.script
    const scenes = raw && typeof raw === 'object' ? (raw as { scenes?: unknown }).scenes : null
    if (!raw || typeof raw !== 'object' || !Array.isArray(scenes) || scenes.length === 0) {
      return { ok: false, status: 400, error: '请先生成第一集剧本' }
    }

    if (await hasConcurrentOutlinePipelineJob(projectId)) {
      return {
        ok: false,
        status: 409,
        error: '已有剧本生成或解析任务进行中，请稍后再试'
      }
    }

    // 创建任务记录
    const job = await this.repo.createPipelineJob({
      projectId,
      status: 'pending',
      jobType: 'parse-script',
      currentStep: 'parse-script',
      progress: 0
    })

    // 异步执行任务，不阻塞响应
    // 使用 setImmediate 确保在下一个事件循环执行，立即返回 jobId
    setImmediate(async () => {
      try {
        await runParseScriptJob(job.id, projectId, targetEpisodes)
      } catch (err) {
        console.error('parse-script job failed', err)
        // 确保错误状态被更新到数据库
        try {
          await pipelineRepository.updateJob(job.id, {
            status: 'failed',
            error: err instanceof Error ? err.message : '解析失败',
            progressMeta: {
              message: err instanceof Error ? err.message : undefined
            }
          })
        } catch (updateErr) {
          console.error('Failed to update job status to failed', updateErr)
        }
      }
    })

    return { ok: true, jobId: job.id }
  }

  async getOutlineActiveJob(userId: string, projectId: string) {
    const project = await this.repo.findFirstOwned(projectId, userId)
    if (!project) {
      return { ok: false as const, status: 404, error: '项目不存在' }
    }
    const job = await getActiveOutlinePipelineJob(projectId)
    if (!job) {
      return { ok: true as const, job: null }
    }
    return {
      ok: true as const,
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

  getProjectDetail(userId: string, projectId: string) {
    return this.repo.findFirstOwnedFullDetail(projectId, userId)
  }

  async updateProject(
    userId: string,
    projectId: string,
    body: UpdateProjectBody
  ): Promise<UpdateProjectResult> {
    const {
      name,
      description,
      synopsis,
      visualStyle: _visualStyle,
      visualStyleConfig,
      aspectRatio
    } = body

    const project = await this.repo.findFirstOwned(projectId, userId)
    if (!project) {
      return { ok: false, status: 404, error: 'Project not found' }
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (synopsis !== undefined) data.synopsis = synopsis
    // visualStyle 已废弃，不再处理
    if (visualStyleConfig !== undefined) {
      if (visualStyleConfig !== null && typeof visualStyleConfig !== 'object') {
        return { ok: false, status: 400, error: 'visualStyleConfig 须为对象或 null' }
      }
      data.visualStyleConfig = visualStyleConfig
    }
    if (aspectRatio !== undefined) {
      if (typeof aspectRatio !== 'string') {
        return { ok: false, status: 400, error: 'aspectRatio 须为字符串' }
      }
      data.aspectRatio = normalizeProjectDefaultAspectRatio(aspectRatio)
    }

    if (Object.keys(data).length === 0) {
      return { ok: true, project }
    }

    const updated = await this.repo.update(projectId, data as Prisma.ProjectUpdateInput)
    return { ok: true, project: updated }
  }

  async deleteProject(userId: string, projectId: string): Promise<boolean> {
    const project = await this.repo.findFirstOwned(projectId, userId)
    if (!project) {
      return false
    }
    await this.repo.delete(projectId)
    return true
  }
}

export const projectService = new ProjectService(projectRepository)
