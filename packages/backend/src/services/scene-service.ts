import type { VideoJobData, VideoModel } from '@dreamer/shared/types'
import { videoQueue } from '../queues/video.js'
import { optimizePrompt } from './ai/deepseek.js'
import { stitchScenePrompt } from './scene-prompt.js'
import { sceneRepository, type SceneRepository } from '../repositories/scene-repository.js'
import { buildSeedanceScenePayload } from './ai/seedance-scene-request.js'
import { logError } from '../lib/error-logger.js'

export interface VideoQueueLike {
  add(name: string, data: VideoJobData): Promise<unknown>
}

export class SceneService {
  constructor(
    private readonly repository: SceneRepository,
    private readonly queue: VideoQueueLike
  ) {}

  async resolveSceneGeneratePrompt(sceneId: string): Promise<string> {
    const scene = await this.repository.findSceneWithShotsOrdered(sceneId)
    if (!scene) return ''
    const stitched = stitchScenePrompt(
      scene.shots.map((s) => ({
        shotNum: s.shotNum,
        order: s.order,
        description: s.description,
        cameraMovement: s.cameraMovement,
        cameraAngle: s.cameraAngle
      }))
    )
    if (stitched.trim()) return stitched
    return scene.description.trim() || ' '
  }

  listByEpisode(episodeId: string) {
    return this.repository.findManyByEpisodeWithTakes(episodeId)
  }

  getByIdWithTakesAndShots(sceneId: string) {
    return this.repository.findUniqueWithTakesAndShots(sceneId)
  }

  async createSceneWithFirstShot(
    episodeId: string,
    sceneNum: number,
    prompt: string,
    description?: string
  ) {
    const episode = await this.repository.findEpisodeWithProjectAspect(episodeId)
    if (!episode) {
      return { ok: false as const, reason: 'episode_not_found' }
    }

    const DEFAULT_SCENE_DURATION_MS = 5000

    const scene = await this.repository.createScene({
      episodeId,
      sceneNum,
      description: description ?? '',
      duration: DEFAULT_SCENE_DURATION_MS,
      aspectRatio: episode.project.aspectRatio ?? '9:16',
      visualStyle: [],
      status: 'pending'
    })

    await this.repository.createShot({
      sceneId: scene.id,
      shotNum: 1,
      order: 1,
      description: prompt,
      duration: DEFAULT_SCENE_DURATION_MS
    })

    return { ok: true as const, scene }
  }

  async updateScene(
    sceneId: string,
    body: { description?: string; sceneNum?: number; prompt?: string }
  ) {
    const { description, sceneNum, prompt } = body

    if (prompt !== undefined) {
      const firstShot = await this.repository.findFirstShotByScene(sceneId)
      if (firstShot) {
        await this.repository.updateShot(firstShot.id, { description: prompt })
      }
    }

    return this.repository.updateScene(sceneId, {
      ...(description !== undefined && { description }),
      ...(sceneNum !== undefined && { sceneNum })
    })
  }

  async deleteSceneIfExists(sceneId: string): Promise<boolean> {
    const scene = await this.repository.findSceneById(sceneId)
    if (!scene) return false
    await this.repository.deleteScene(sceneId)
    return true
  }

  async enqueueVideoGenerate(
    sceneId: string,
    body: {
      model: VideoModel
      referenceImage?: string
      imageUrls?: string[]
      duration?: number
    }
  ): Promise<{ ok: true; taskId: string; sceneId: string } | { ok: false; reason: 'no_prompt' }> {
    const { model, referenceImage, duration: bodyDuration } = body
    let imageUrls = body.imageUrls
    let prompt = await this.resolveSceneGeneratePrompt(sceneId)
    let duration = bodyDuration

    const useAuto =
      model === 'seedance2.0' && (!imageUrls || imageUrls.length === 0) && !referenceImage

    let aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive' | undefined

    if (useAuto) {
      const built = await buildSeedanceScenePayload(sceneId)
      if (built && built.prompt.trim()) {
        prompt = built.prompt
        imageUrls = built.imageUrls
        aspectRatio = built.aspectRatio
        if (duration === undefined) duration = built.durationSeconds
      }
    }

    if (!prompt.trim()) {
      return { ok: false, reason: 'no_prompt' }
    }

    const task = await this.repository.createTake({
      sceneId,
      model,
      status: 'queued',
      prompt
    })

    await this.queue.add('generate-video', {
      sceneId,
      taskId: task.id,
      prompt,
      model,
      referenceImage,
      imageUrls,
      duration,
      aspectRatio
    })

    await this.repository.updateScene(sceneId, { status: 'generating' })

    return { ok: true, taskId: task.id, sceneId }
  }

  async batchEnqueueVideoGenerate(
    userId: string,
    sceneIds: string[],
    model: VideoModel,
    referenceImage: string | undefined,
    imageUrls: string[] | undefined,
    verifySceneOwnership: (userId: string, sceneId: string) => Promise<boolean>
  ): Promise<{ sceneId: string; taskId: string }[]> {
    const results: { sceneId: string; taskId: string }[] = []

    for (const sceneId of sceneIds) {
      if (!(await verifySceneOwnership(userId, sceneId))) {
        continue
      }

      let prompt = await this.resolveSceneGeneratePrompt(sceneId)
      let effectiveImageUrls = imageUrls
      let effectiveDuration: number | undefined = undefined
      let aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive' | undefined

      if (
        model === 'seedance2.0' &&
        (!effectiveImageUrls || effectiveImageUrls.length === 0) &&
        !referenceImage
      ) {
        const built = await buildSeedanceScenePayload(sceneId)
        if (built?.prompt.trim()) {
          prompt = built.prompt
          effectiveImageUrls = built.imageUrls
          effectiveDuration = built.durationSeconds
          aspectRatio = built.aspectRatio
        }
      }

      if (!prompt.trim()) continue

      const task = await this.repository.createTake({
        sceneId,
        model,
        status: 'queued',
        prompt
      })

      await this.queue.add('generate-video', {
        sceneId,
        taskId: task.id,
        prompt,
        model,
        referenceImage,
        imageUrls: effectiveImageUrls,
        duration: effectiveDuration,
        aspectRatio
      })

      await this.repository.updateScene(sceneId, { status: 'generating' })

      results.push({ sceneId, taskId: task.id })
    }

    return results
  }

  async selectTaskInScene(sceneId: string, taskId: string) {
    await this.repository.takeUpdateManyForScene(sceneId, { isSelected: false })
    return this.repository.takeUpdate(taskId, { isSelected: true })
  }

  listTasksForScene(sceneId: string) {
    return this.repository.takeFindManyByScene(sceneId)
  }

  async optimizeScenePrompt(
    sceneId: string,
    userId: string,
    bodyPrompt?: string
  ): Promise<
    | { ok: true; optimizedPrompt: string; aiCost: number }
    | { ok: false; reason: 'not_found' }
    | { ok: false; reason: 'deepseek_auth'; message: string }
    | { ok: false; reason: 'deepseek_rate'; message: string }
    | { ok: false; reason: 'optimize_failed' }
  > {
    const scene = await this.repository.findSceneForOptimizePrompt(sceneId)
    if (!scene) {
      return { ok: false, reason: 'not_found' }
    }

    const targetPrompt = bodyPrompt || (await this.resolveSceneGeneratePrompt(sceneId))

    const characters = scene.episode.project.characters
    const context =
      characters.length > 0
        ? `角色设定：${characters.map((c) => `${c.name}: ${c.description || '未描述'}`).join('; ')}`
        : undefined

    try {
      const { optimized, cost } = await optimizePrompt(targetPrompt, context, {
        userId,
        projectId: scene.episode.projectId,
        op: 'scene_optimize_prompt'
      })

      if (!bodyPrompt && scene.shots.length > 0) {
        const first = scene.shots[0]
        await this.repository.updateShot(first.id, { description: optimized })
      }

      return { ok: true, optimizedPrompt: optimized, aiCost: cost.costCNY }
    } catch (error) {
      logError('ScenePromptOptimization', 'Prompt optimization failed', {
        error: error instanceof Error ? error.message : String(error)
      })

      if (error instanceof Error && error.name === 'DeepSeekAuthError') {
        return { ok: false, reason: 'deepseek_auth', message: error.message }
      }

      if (error instanceof Error && error.name === 'DeepSeekRateLimitError') {
        return { ok: false, reason: 'deepseek_rate', message: error.message }
      }

      return { ok: false, reason: 'optimize_failed' }
    }
  }
}

export const sceneService = new SceneService(sceneRepository, videoQueue)
