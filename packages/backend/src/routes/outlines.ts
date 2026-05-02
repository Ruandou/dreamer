import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { getRequestUserId } from '../plugins/auth.js'

export async function outlineRoutes(fastify: FastifyInstance) {
  // Get project outline
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { projectId } = request.params

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId }
      })
      if (!project) {
        return reply.status(404).send({ error: '项目不存在' })
      }

      const outline = await prisma.projectOutline.findUnique({
        where: { projectId }
      })

      const episodes = await prisma.episode.findMany({
        where: { projectId },
        orderBy: { episodeNum: 'asc' },
        select: {
          id: true,
          episodeNum: true,
          title: true,
          synopsis: true,
          hook: true,
          cliffhanger: true,
          isPaywall: true,
          writeStatus: true
        }
      })

      return {
        outline: outline || null,
        episodes,
        projectStatus: project.status
      }
    }
  )

  // Update outline episode
  fastify.put<{
    Params: { projectId: string; episodeNum: number }
    Body: {
      title?: string
      synopsis?: string
      hook?: string
      cliffhanger?: string
      isPaywall?: boolean
    }
  }>(
    '/:projectId/episodes/:episodeNum',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { projectId, episodeNum } = request.params
      const updates = request.body

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId }
      })
      if (!project) {
        return reply.status(404).send({ error: '项目不存在' })
      }

      const episode = await prisma.episode.findUnique({
        where: { projectId_episodeNum: { projectId, episodeNum } }
      })
      if (!episode) {
        return reply.status(404).send({ error: '集数不存在' })
      }

      const updated = await prisma.episode.update({
        where: { id: episode.id },
        data: updates
      })

      // Also update in ProjectOutline if exists
      const outline = await prisma.projectOutline.findUnique({
        where: { projectId }
      })
      if (outline) {
        const episodes = outline.episodes as Array<{
          episodeNum: number
          title?: string
          synopsis?: string
          hook?: string
          cliffhanger?: string
          isPaywall?: boolean
        }>
        const idx = episodes.findIndex((e) => e.episodeNum === episodeNum)
        if (idx >= 0) {
          episodes[idx] = { ...episodes[idx], ...updates }
          await prisma.projectOutline.update({
            where: { projectId },
            data: { episodes }
          })
        }
      }

      return updated
    }
  )

  // Update project status (outline -> writing -> final)
  fastify.post<{
    Params: { projectId: string }
    Body: { status: string }
  }>('/:projectId/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getRequestUserId(request)
    const { projectId } = request.params
    const { status } = request.body

    const validStatuses = ['outlining', 'writing', 'final', 'ad']
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ error: 'Invalid status' })
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    })
    if (!project) {
      return reply.status(404).send({ error: '项目不存在' })
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { status }
    })

    return updated
  })
}
