import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { expandScript } from '../services/deepseek.js'
import { verifyEpisodeOwnership, verifyProjectOwnership } from '../plugins/auth.js'
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
        return reply.status(403).send({ error: 'Forbidden: You do not own this project' })
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
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this episode' })
      }

      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: { scenes: true }
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
        return reply.status(403).send({ error: 'Forbidden: You do not own this project' })
      }

      const episode = await prisma.episode.create({
        data: { projectId, episodeNum, title }
      })

      return reply.status(201).send(episode)
    }
  )

  // Update episode (including script content)
  fastify.put<{ Params: { id: string }; Body: { title?: string; script?: any; rawScript?: any } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this episode' })
      }

      const { title, script, rawScript } = request.body
      const scriptPayload = rawScript ?? script

      const episode = await prisma.episode.update({
        where: { id: episodeId },
        data: { title, ...(scriptPayload !== undefined && { rawScript: scriptPayload }) }
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
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this episode' })
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
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this episode' })
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
                aspectRatio: '9:16',
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
