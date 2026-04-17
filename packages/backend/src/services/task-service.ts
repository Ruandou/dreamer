import type { Take } from '@prisma/client'
import { TakeRepository } from '../repositories/take-repository.js'
import { takeRepository } from '../repositories/take-repository.js'

export type TaskWithSceneMeta = Take & {
  sceneNum: number
  sceneDescription: string | null
}

export type CancelTaskResult =
  | { ok: true; task: Take }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 404; error: string }

export type RetryTaskResult =
  | { ok: true; task: Take }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 404; error: string }

export class TaskService {
  constructor(private readonly takeRepo: TakeRepository) {}

  getById(taskId: string) {
    return this.takeRepo.findById(taskId)
  }

  async listByProject(projectId: string): Promise<TaskWithSceneMeta[]> {
    const scenes = await this.takeRepo.findScenesWithTakesByProject(projectId)

    const tasks = scenes.flatMap((scene) =>
      scene.takes.map((task) => ({
        ...task,
        sceneNum: scene.sceneNum,
        sceneDescription: scene.description
      }))
    )

    return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async cancelTask(taskId: string): Promise<CancelTaskResult> {
    const task = await this.takeRepo.findById(taskId)
    if (!task) {
      return { ok: false, status: 404, error: 'Task not found' }
    }

    if (task.status === 'completed' || task.status === 'failed') {
      return { ok: false, status: 400, error: 'Cannot cancel a completed or failed task' }
    }

    const updatedTask = await this.takeRepo.update(taskId, {
      status: 'failed',
      errorMsg: 'Cancelled by user'
    })

    await this.takeRepo.updateScene(task.sceneId, { status: 'pending' })

    return { ok: true, task: updatedTask }
  }

  async retryTask(taskId: string): Promise<RetryTaskResult> {
    const task = await this.takeRepo.findById(taskId)
    if (!task) {
      return { ok: false, status: 404, error: 'Task not found' }
    }

    if (task.status !== 'failed') {
      return { ok: false, status: 400, error: 'Can only retry failed tasks' }
    }

    const newTask = await this.takeRepo.create({
      sceneId: task.sceneId,
      model: task.model,
      status: 'queued',
      prompt: task.prompt
    })

    await this.takeRepo.updateScene(task.sceneId, { status: 'generating' })

    const { videoQueue } = await import('../queues/video.js')
    await videoQueue.add('generate-video', {
      sceneId: task.sceneId,
      taskId: newTask.id,
      prompt: task.prompt,
      model: task.model as 'wan2.6' | 'seedance2.0'
    })

    return { ok: true, task: newTask }
  }
}

export const taskService = new TaskService(takeRepository)
