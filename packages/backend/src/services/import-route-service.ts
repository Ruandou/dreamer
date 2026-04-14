import { prisma } from '../lib/prisma.js'
import { importQueue } from '../queues/import.js'
import { parseScriptDocument } from './parser.js'
import { ImportRepository } from '../repositories/import-repository.js'

export type PreviewImportResult =
  | {
      ok: true
      preview: {
        projectName: string
        description: string
        characters: unknown
        episodes: Array<{
          episodeNum: number
          title: string
          sceneCount: number
          scenes: Array<{ sceneNum: number; description: string }>
        }>
      }
      aiCost: number
    }
  | { ok: false; status: 400; error: string; message?: string }

export class ImportRouteService {
  constructor(private readonly repo: ImportRepository) {}

  async previewImport(
    userId: string,
    content: string,
    type: 'markdown' | 'json'
  ): Promise<PreviewImportResult> {
    if (!content) {
      return { ok: false, status: 400, error: '缺少必要参数' }
    }

    try {
      const { parsed, cost } = await parseScriptDocument(content, type, {
        userId,
        op: 'import_preview_parse'
      })

      return {
        ok: true,
        preview: {
          projectName: parsed.projectName,
          description: parsed.description,
          characters: parsed.characters,
          episodes: parsed.episodes.map(ep => ({
            episodeNum: ep.episodeNum,
            title: ep.title,
            sceneCount: ep.scenes.length,
            scenes: ep.scenes.slice(0, 3).map(s => ({
              sceneNum: s.sceneNum,
              description:
                s.description.slice(0, 100) + (s.description.length > 100 ? '...' : '')
            }))
          }))
        },
        aiCost: cost?.costCNY || 0
      }
    } catch (error) {
      console.error('Preview failed:', error)
      return {
        ok: false,
        status: 400,
        error: '解析预览失败',
        message: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  async enqueueScriptImport(
    userId: string,
    projectId: string,
    content: string,
    type: 'markdown' | 'json'
  ) {
    const task = await this.repo.create({
      userId,
      projectId,
      content,
      type,
      status: 'pending'
    })

    await importQueue.add('import-script', {
      taskId: task.id,
      projectId,
      userId,
      content,
      type
    })

    return { taskId: task.id, status: 'pending' as const }
  }

  async enqueueProjectImport(
    userId: string,
    content: string,
    type: 'markdown' | 'json'
  ) {
    const task = await this.repo.create({
      userId,
      content,
      type,
      status: 'pending'
    })

    await importQueue.add('import-project', {
      taskId: task.id,
      userId,
      content,
      type
    })

    return { taskId: task.id, status: 'pending' as const }
  }

  async getImportTask(taskId: string) {
    return this.repo.findById(taskId)
  }

  async listImportTasks(userId: string, limit: number, offset: number) {
    const [tasks, total] = await Promise.all([
      this.repo.findManyForUser(userId, limit, offset),
      this.repo.countForUser(userId)
    ])
    return { tasks, total }
  }
}

export const importRepository = new ImportRepository(prisma)
export const importRouteService = new ImportRouteService(importRepository)
