import type { Prisma } from '@prisma/client'
import { importRepository } from '../repositories/import-repository.js'
import { projectRepository } from '../repositories/project-repository.js'

export const importWorkerService = {
  markProcessing(taskId: string) {
    return importRepository.update(taskId, { status: 'processing', errorMsg: null })
  },

  createProjectForImport(data: { name: string; description: string; userId: string }) {
    return projectRepository.create({
      name: data.name,
      description: data.description,
      userId: data.userId
    })
  },

  updateTaskProjectId(taskId: string, projectId: string) {
    return importRepository.update(taskId, { projectId })
  },

  markCompleted(taskId: string, result: unknown) {
    return importRepository.update(taskId, {
      status: 'completed',
      result: result as Prisma.InputJsonValue
    })
  },

  markFailed(taskId: string, errorMsg: string) {
    return importRepository.update(taskId, {
      status: 'failed',
      errorMsg
    })
  }
}
