import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { expandScript } from '../services/deepseek.js'
import { runCompositionExport } from '../services/composition-export.js'
import { verifyEpisodeOwnership, verifyProjectOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import type { ScriptContent } from '@dreamer/shared/types'

export async function episodeRoutes(fastify: FastifyInstance) {
  // List episodes for a project
  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId } = request.query

      // Verify project ownership
      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      return prisma.episode.findMany({
        where: { projectId },
        orderBy: { episodeNum: 'asc' }
      })
    }
  )

  // Get episode
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const episode = await prisma.episode.findUnique({
        where: { id: episodeId }
      })

      if (!episode) {
        return reply.status(404).send({ error: 'Episode not found' })
      }

      return episode
    }
  )

  // Create episode
  fastify.post<{ Body: { projectId: string; episodeNum: number; title?: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId, episodeNum, title } = request.body

      // Verify project ownership
      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const episode = await prisma.episode.create({
        data: { projectId, episodeNum, title }
      })

      return reply.status(201).send(episode)
    }
  )

  // Update episode (including script content)
  fastify.put<{
    Params: { id: string }
    Body: { title?: string; synopsis?: string | null; script?: any; rawScript?: any }
  }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const { title, synopsis, script, rawScript } = request.body
      const scriptPayload = rawScript ?? script

      const episode = await prisma.episode.update({
        where: { id: episodeId },
        data: {
          title,
          ...(synopsis !== undefined && { synopsis }),
          ...(scriptPayload !== undefined && { rawScript: scriptPayload })
        }
      })

      return episode
    }
  )

  // Delete episode
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      // Check if exists first
      const episode = await prisma.episode.findUnique({ where: { id: episodeId } })
      if (!episode) {
        return reply.status(404).send({ error: 'Episode not found' })
      }

      await prisma.episode.delete({ where: { id: episodeId } })
      return reply.status(204).send()
    }
  )

  /** 按当前集场次与已选 Take 写入时间线并导出成片（复用 Composition + ffmpeg） */
  fastify.post<{ Params: { id: string }; Body: { title?: string } }>(
    '/:id/compose',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id
      const titleOverride = request.body?.title

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: {
          scenes: {
            orderBy: { sceneNum: 'asc' },
            include: {
              takes: { where: { isSelected: true } }
            }
          }
        }
      })

      if (!episode) {
        return reply.status(404).send({ error: 'Episode not found' })
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
          return reply.status(400).send({ error: '该集暂无场次' })
        }
        return reply.status(400).send({ error: '无法合成', details: issues })
      }

      let composition = await prisma.composition.findFirst({
        where: { episodeId }
      })

      const defaultTitle =
        titleOverride?.trim() || episode.title || `第${episode.episodeNum}集`

      if (!composition) {
        composition = await prisma.composition.create({
          data: {
            projectId: episode.projectId,
            episodeId,
            title: defaultTitle
          }
        })
      } else if (titleOverride?.trim()) {
        composition = await prisma.composition.update({
          where: { id: composition.id },
          data: { title: titleOverride.trim() }
        })
      }

      await prisma.compositionScene.deleteMany({ where: { compositionId: composition.id } })
      await prisma.compositionScene.createMany({
        data: clips.map((c) => ({
          compositionId: composition.id,
          sceneId: c.sceneId,
          takeId: c.takeId,
          order: c.order
        }))
      })

      const exportResult = await runCompositionExport(composition.id)
      if (!exportResult.ok) {
        return reply.status(exportResult.httpStatus).send({
          error: exportResult.error,
          compositionId: composition.id
        })
      }

      return {
        compositionId: composition.id,
        outputUrl: exportResult.outputUrl,
        duration: exportResult.duration,
        message: '合成完成'
      }
    }
  )

  // Expand script with AI (DeepSeek)
  fastify.post<{ Params: { id: string }; Body: { summary: string } }>(
    '/:id/expand',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { summary } = request.body
      const episodeId = request.params.id

      // Verify ownership
      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      // Verify episode exists
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId }
      })

      if (!episode) {
        return reply.status(404).send({ error: 'Episode not found' })
      }

      try {
        // Get project context (characters, existing episodes)
        const project = await prisma.project.findUnique({
          where: { id: episode.projectId },
          include: {
            characters: { select: { name: true, description: true } },
            episodes: { select: { title: true, episodeNum: true } }
          }
        })

        const projectContext = project
          ? `项目名称: ${project.name}\n已有角色: ${project.characters.map(c => c.name).join(', ') || '暂无'}\n已有集数: ${project.episodes.length}集`
          : undefined

        // Call DeepSeek API
        const { script, cost } = await expandScript(summary, projectContext)

        // Save to episode
        const updatedEpisode = await prisma.episode.update({
          where: { id: episodeId },
          data: {
            title: script.title || episode.title,
            rawScript: script as any
          }
        })

        if (script.scenes && script.scenes.length > 0) {
          await prisma.scene.deleteMany({ where: { episodeId } })

          for (const sc of script.scenes) {
            let locationId: string | undefined
            if (sc.location) {
              const loc = await prisma.location.findFirst({
                where: { projectId: episode.projectId, name: sc.location }
              })
              locationId = loc?.id
            }

            const scene = await prisma.scene.create({
              data: {
                episodeId,
                sceneNum: sc.sceneNum || 1,
                locationId,
                timeOfDay: sc.timeOfDay,
                description: sc.description || `${sc.location} - ${sc.timeOfDay}`,
                duration: 5000,
                aspectRatio: project?.aspectRatio ?? '9:16',
                visualStyle: [],
                status: 'pending'
              }
            })

            await prisma.shot.create({
              data: {
                sceneId: scene.id,
                shotNum: 1,
                order: 1,
                description: buildScenePrompt(sc, script.title || ''),
                duration: 5000
              }
            })
          }
        }

        return {
          episode: updatedEpisode,
          script,
          scenesCreated: script.scenes?.length || 0,
          aiCost: cost.costCNY
        }
      } catch (error) {
        console.error('Script expansion failed:', error)

        if (error instanceof Error && error.name === 'DeepSeekAuthError') {
          return reply.status(401).send({
            error: 'AI 服务认证失败',
            message: error.message
          })
        }

        if (error instanceof Error && error.name === 'DeepSeekRateLimitError') {
          return reply.status(429).send({
            error: 'AI 服务请求受限',
            message: error.message
          })
        }

        return reply.status(500).send({
          error: '剧本生成失败',
          message: error instanceof Error ? error.message : '未知错误'
        })
      }
    }
  )
}

// Helper function to build video prompt from scene
function buildScenePrompt(scene: any, scriptTitle: string): string {
  const parts = [
    scriptTitle,
    scene.location,
    scene.timeOfDay,
    scene.description,
    scene.actions?.join(' ') || '',
    scene.dialogues?.map((d: any) => `${d.character}: ${d.content}`).join(' ') || ''
  ].filter(Boolean)

  return parts.join(', ')
}
