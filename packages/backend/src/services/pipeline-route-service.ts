import { prisma } from '../lib/prisma.js'
import { executePipelineJob } from './pipeline-executor.js'
import { pipelineAspectRatioFromProjectDefault } from '../lib/project-aspect.js'
import { PipelineRepository } from '../repositories/pipeline-repository.js'

export class PipelineRouteService {
  constructor(private readonly repo: PipelineRepository) {}

  getStepsCatalog() {
    return {
      steps: [
        { id: 'script-writing', description: '剧本生成 - 使用 DeepSeek AI 从想法生成专业剧本' },
        { id: 'episode-split', description: '智能分集 - 将剧本按起承转合结构分割成多集' },
        { id: 'segment-extract', description: '分镜提取 - 提取角色、场景和动作' },
        { id: 'storyboard', description: '分镜生成 - 生成带提示词的分镜片段' }
      ]
    }
  }

  async createAndStartFullPipeline(
    userId: string,
    body: {
      projectId: string
      idea: string
      targetEpisodes?: number
      targetDuration?: number
      defaultAspectRatio?: '16:9' | '9:16' | '1:1'
      defaultResolution?: '480p' | '720p'
    }
  ): Promise<
    | { ok: true; jobId: string }
    | { ok: false; status: 400; error: string }
    | { ok: false; status: 404; error: string }
    | { ok: false; status: 500; error: string }
  > {
    const { projectId, idea, targetEpisodes, targetDuration, defaultAspectRatio, defaultResolution } =
      body

    if (!projectId || !idea) {
      return { ok: false, status: 400, error: '缺少必要参数: projectId, idea' }
    }

    try {
      const project = await this.repo.findFirstProjectOwned(projectId, userId)
      if (!project) {
        return { ok: false, status: 404, error: '项目不存在' }
      }

      const job = await this.repo.createPipelineJob({
        projectId,
        status: 'pending',
        jobType: 'full-pipeline',
        currentStep: 'script-writing',
        progress: 0
      })

      await this.repo.createPipelineStepResultsMany([
        { jobId: job.id, step: 'script-writing', status: 'pending' },
        { jobId: job.id, step: 'episode-split', status: 'pending' },
        { jobId: job.id, step: 'segment-extract', status: 'pending' },
        { jobId: job.id, step: 'storyboard', status: 'pending' }
      ])

      const resolvedAspect = pipelineAspectRatioFromProjectDefault(
        defaultAspectRatio ?? project.aspectRatio
      )

      executePipelineJob(job.id, {
        projectId,
        idea,
        targetEpisodes,
        targetDuration,
        defaultAspectRatio: resolvedAspect,
        defaultResolution: defaultResolution || '720p'
      }).catch(error => {
        console.error(`Pipeline Job ${job.id} failed:`, error)
      })

      return { ok: true, jobId: job.id }
    } catch (error) {
      console.error('Failed to create pipeline job:', error)
      return {
        ok: false,
        status: 500,
        error: error instanceof Error ? error.message : '创建 Pipeline 失败'
      }
    }
  }

  async getJobDetail(userId: string, jobId: string) {
    const job = await this.repo.findUniqueJobWithSteps(jobId)
    if (!job) {
      return { ok: false as const, status: 404, error: 'Job 不存在' }
    }

    const project = await this.repo.findFirstProjectOwned(job.projectId, userId)
    if (!project) {
      return { ok: false as const, status: 404, error: 'Job 不存在' }
    }

    return {
      ok: true as const,
      data: {
        id: job.id,
        projectId: job.projectId,
        status: job.status,
        jobType: job.jobType,
        currentStep: job.currentStep,
        progress: job.progress,
        progressMeta: job.progressMeta,
        error: job.error,
        stepResults: job.stepResults,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    }
  }

  async getProjectPipelineStatus(userId: string, projectId: string) {
    const project = await this.repo.findFirstProjectOwned(projectId, userId)
    if (!project) {
      return { ok: false as const, status: 404, error: '项目不存在' }
    }

    const job = await this.repo.findFirstJobByProjectNewest(projectId)
    if (!job) {
      return { ok: true as const, data: { status: 'not_started' as const } }
    }

    return {
      ok: true as const,
      data: {
        id: job.id,
        status: job.status,
        currentStep: job.currentStep,
        progress: job.progress,
        error: job.error,
        stepResults: job.stepResults
      }
    }
  }

  async listJobsForUser(userId: string) {
    const jobs = await this.repo.findManyJobsForUser(userId)
    return jobs.map(job => ({
      id: job.id,
      projectId: job.projectId,
      projectName: job.project?.name,
      jobType: job.jobType,
      status: job.status,
      currentStep: job.currentStep,
      progress: job.progress,
      progressMeta: job.progressMeta,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }))
  }

  async cancelJob(
    userId: string,
    jobId: string
  ): Promise<
    | { ok: true }
    | { ok: false; status: 404; error: string }
    | { ok: false; status: 400; error: string }
  > {
    const job = await this.repo.findUniqueJob(jobId)
    if (!job) {
      return { ok: false, status: 404, error: 'Job 不存在' }
    }

    const project = await this.repo.findFirstProjectOwned(job.projectId, userId)
    if (!project) {
      return { ok: false, status: 404, error: 'Job 不存在' }
    }

    if (job.status === 'running') {
      return { ok: false, status: 400, error: '无法取消正在运行的 Job' }
    }

    await this.repo.updateJob(jobId, { status: 'failed', error: '用户取消' })
    return { ok: true }
  }
}

export const pipelineRepository = new PipelineRepository(prisma)
export const pipelineRouteService = new PipelineRouteService(pipelineRepository)
