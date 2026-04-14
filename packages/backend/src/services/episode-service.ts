import type { Episode, Prisma } from '@prisma/client'
import { expandScript } from './deepseek.js'
import { runCompositionExport } from './composition-export.js'
import { episodeRepository, type EpisodeRepository } from '../repositories/episode-repository.js'

function buildScenePrompt(scene: {
  location?: string
  timeOfDay?: string
  description?: string
  actions?: string[]
  dialogues?: Array<{ character: string; content: string }>
}, scriptTitle: string): string {
  const parts = [
    scriptTitle,
    scene.location,
    scene.timeOfDay,
    scene.description,
    scene.actions?.join(' ') || '',
    scene.dialogues?.map(d => `${d.character}: ${d.content}`).join(' ') || ''
  ].filter(Boolean)

  return parts.join(', ')
}

export type ComposeEpisodeResult =
  | { ok: true; compositionId: string; outputUrl: string; duration: number }
  | { ok: false; status: 400; error: string; details?: string[] }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: number; error: string; compositionId: string }

export type ExpandEpisodeResult =
  | {
      ok: true
      episode: Episode
      script: unknown
      scenesCreated: number
      aiCost: number
    }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 401; error: string; message: string }
  | { ok: false; status: 429; error: string; message: string }
  | { ok: false; status: 500; error: string; message: string }

export class EpisodeService {
  constructor(private readonly repo: EpisodeRepository) {}

  listByProject(projectId: string) {
    return this.repo.findManyByProject(projectId)
  }

  getById(episodeId: string) {
    return this.repo.findUnique(episodeId)
  }

  createEpisode(projectId: string, episodeNum: number, title?: string) {
    return this.repo.create({
      projectId,
      episodeNum,
      ...(title !== undefined ? { title } : {})
    })
  }

  updateEpisode(
    episodeId: string,
    body: { title?: string; synopsis?: string | null; script?: unknown; rawScript?: unknown }
  ) {
    const { title, synopsis, script, rawScript } = body
    const scriptPayload = rawScript ?? script

    return this.repo.update(episodeId, {
      title,
      ...(synopsis !== undefined && { synopsis }),
      ...(scriptPayload !== undefined && {
        rawScript: scriptPayload as Prisma.InputJsonValue
      })
    })
  }

  async deleteEpisodeIfExists(episodeId: string): Promise<boolean> {
    const ep = await this.repo.findUnique(episodeId)
    if (!ep) return false
    await this.repo.delete(episodeId)
    return true
  }

  async composeEpisode(episodeId: string, titleOverride?: string): Promise<ComposeEpisodeResult> {
    const episode = await this.repo.findUniqueWithScenesTakesForCompose(episodeId)
    if (!episode) {
      return { ok: false, status: 404, error: 'Episode not found' }
    }

    const issues: string[] = []
    const clips: { sceneId: string; takeId: string; order: number }[] = []

    let order = 0
    for (const scene of episode.scenes) {
      const selected = scene.takes[0]
      if (!selected) {
        issues.push(`第 ${scene.sceneNum} 场未选择成片 Take`)
        continue
      }
      if (selected.status !== 'completed' || !selected.videoUrl) {
        issues.push(`第 ${scene.sceneNum} 场所选 Take 尚无成片视频`)
        continue
      }
      order += 1
      clips.push({ sceneId: scene.id, takeId: selected.id, order })
    }

    if (clips.length === 0) {
      if (episode.scenes.length === 0) {
        return { ok: false, status: 400, error: '该集暂无场次' }
      }
      return { ok: false, status: 400, error: '无法合成', details: issues }
    }

    let composition = await this.repo.findCompositionByEpisode(episodeId)

    const defaultTitle =
      titleOverride?.trim() || episode.title || `第${episode.episodeNum}集`

    if (!composition) {
      composition = await this.repo.createComposition({
        projectId: episode.projectId,
        episodeId,
        title: defaultTitle
      })
    } else if (titleOverride?.trim()) {
      composition = await this.repo.updateComposition(composition.id, {
        title: titleOverride.trim()
      })
    }

    await this.repo.deleteCompositionScenesByComposition(composition.id)
    await this.repo.createCompositionScenes(
      clips.map(c => ({
        compositionId: composition.id,
        sceneId: c.sceneId,
        takeId: c.takeId,
        order: c.order
      }))
    )

    const exportResult = await runCompositionExport(composition.id)
    if (!exportResult.ok) {
      return {
        ok: false,
        status: exportResult.httpStatus,
        error: exportResult.error,
        compositionId: composition.id
      }
    }

    return {
      ok: true,
      compositionId: composition.id,
      outputUrl: exportResult.outputUrl,
      duration: exportResult.duration
    }
  }

  async expandEpisodeScript(
    userId: string,
    episodeId: string,
    summary: string
  ): Promise<ExpandEpisodeResult> {
    const episode = await this.repo.findUnique(episodeId)
    if (!episode) {
      return { ok: false, status: 404, error: 'Episode not found' }
    }

    try {
      const project = await this.repo.findProjectForExpandScript(episode.projectId)

      const projectContext = project
        ? `项目名称: ${project.name}\n已有角色: ${project.characters.map(c => c.name).join(', ') || '暂无'}\n已有集数: ${project.episodes.length}集`
        : undefined

      const { script, cost } = await expandScript(summary, projectContext, {
        userId,
        projectId: episode.projectId,
        op: 'episode_expand_script'
      })

      const updatedEpisode = await this.repo.update(episodeId, {
        title: script.title || episode.title,
        rawScript: script as unknown as Prisma.InputJsonValue
      })

      if (script.scenes && script.scenes.length > 0) {
        await this.repo.deleteScenesByEpisode(episodeId)

        for (const sc of script.scenes) {
          let locationId: string | undefined
          if (sc.location) {
            const loc = await this.repo.findLocationByProjectAndName(
              episode.projectId,
              sc.location
            )
            locationId = loc?.id
          }

          const scene = await this.repo.createScene({
            episodeId,
            sceneNum: sc.sceneNum || 1,
            locationId,
            timeOfDay: sc.timeOfDay,
            description: sc.description || `${sc.location} - ${sc.timeOfDay}`,
            duration: 5000,
            aspectRatio: project?.aspectRatio ?? '9:16',
            visualStyle: [],
            status: 'pending'
          })

          await this.repo.createShot({
            sceneId: scene.id,
            shotNum: 1,
            order: 1,
            description: buildScenePrompt(sc, script.title || ''),
            duration: 5000
          })
        }
      }

      return {
        ok: true,
        episode: updatedEpisode,
        script,
        scenesCreated: script.scenes?.length || 0,
        aiCost: cost.costCNY
      }
    } catch (error) {
      console.error('Script expansion failed:', error)

      if (error instanceof Error && error.name === 'DeepSeekAuthError') {
        return {
          ok: false,
          status: 401,
          error: 'AI 服务认证失败',
          message: error.message
        }
      }

      if (error instanceof Error && error.name === 'DeepSeekRateLimitError') {
        return {
          ok: false,
          status: 429,
          error: 'AI 服务请求受限',
          message: error.message
        }
      }

      return {
        ok: false,
        status: 500,
        error: '剧本生成失败',
        message: error instanceof Error ? error.message : '未知错误'
      }
    }
  }
}

export const episodeService = new EpisodeService(episodeRepository)
