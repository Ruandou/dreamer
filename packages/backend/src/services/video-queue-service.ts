import { takeRepository } from '../repositories/take-repository.js'

/**
 * 视频生成 Worker 的数据库编排（Take / Scene 状态），与 HTTP 解耦。
 */
export class VideoQueueService {
  constructor(private readonly takes: typeof takeRepository) {}

  async getProjectUserIdForTask(taskId: string): Promise<string | undefined> {
    const task = await this.takes.findByIdWithProjectChain(taskId)
    return task?.scene.episode.project.userId
  }

  setTaskProcessing(taskId: string) {
    return this.takes.update(taskId, { status: 'processing' })
  }

  setTaskExternalTaskId(taskId: string, externalTaskId: string) {
    return this.takes.update(taskId, { externalTaskId })
  }

  setTaskCompleted(
    taskId: string,
    data: {
      videoUrl: string
      thumbnailUrl: string
      cost: number
      duration: number
    }
  ) {
    return this.takes.update(taskId, {
      status: 'completed',
      videoUrl: data.videoUrl,
      thumbnailUrl: data.thumbnailUrl,
      cost: data.cost,
      duration: data.duration
    })
  }

  setTaskFailed(taskId: string, errorMsg: string) {
    return this.takes.update(taskId, {
      status: 'failed',
      errorMsg
    })
  }

  setSceneGenerating(sceneId: string) {
    return this.takes.updateScene(sceneId, { status: 'generating' })
  }

  setSceneCompleted(sceneId: string) {
    return this.takes.updateScene(sceneId, { status: 'completed' })
  }

  setSceneFailed(sceneId: string) {
    return this.takes.updateScene(sceneId, { status: 'failed' })
  }
}

export const videoQueueService = new VideoQueueService(takeRepository)
