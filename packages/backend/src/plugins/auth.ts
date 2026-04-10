import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { prisma } from '../index.js'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export const authPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })
})

// Helper to verify user owns the project
export async function verifyProjectOwnership(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true }
  })
  return project?.userId === userId
}

// Helper to verify user owns the episode's project
export async function verifyEpisodeOwnership(userId: string, episodeId: string): Promise<boolean> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { project: { select: { userId: true } } }
  })
  return episode?.project.userId === userId
}

// Helper to verify user owns the scene's project
export async function verifySceneOwnership(userId: string, sceneId: string): Promise<boolean> {
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: { episode: { include: { project: { select: { userId: true } } } } }
  })
  return scene?.episode.project.userId === userId
}

// Helper to verify user owns the character's project
export async function verifyCharacterOwnership(userId: string, characterId: string): Promise<boolean> {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { project: { select: { userId: true } } }
  })
  return character?.project.userId === userId
}

// Helper to verify user owns the composition's project
export async function verifyCompositionOwnership(userId: string, compositionId: string): Promise<boolean> {
  const composition = await prisma.composition.findUnique({
    where: { id: compositionId },
    include: { project: { select: { userId: true } } }
  })
  return composition?.project.userId === userId
}

// Helper to verify user owns the task's scene's project
export async function verifyTaskOwnership(userId: string, taskId: string): Promise<boolean> {
  const task = await prisma.videoTask.findUnique({
    where: { id: taskId },
    include: {
      scene: {
        include: {
          episode: {
            include: {
              project: {
                select: { userId: true }
              }
            }
          }
        }
      }
    }
  })
  return task?.scene.episode.project.userId === userId
}
