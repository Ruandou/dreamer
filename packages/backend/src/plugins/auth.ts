import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { userRepository } from '../repositories/user-repository.js'
import { ownershipRepository } from '../repositories/ownership-repository.js'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export const authPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const payload = request.user as { id?: string }
    if (!payload?.id) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const dbUser = await userRepository.findForAuthSession(payload.id)
    if (!dbUser) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: '登录已失效，请重新登录'
      })
    }

    ;(request as any).user = dbUser
  })
})

// Helper to verify user owns the project
export async function verifyProjectOwnership(userId: string, projectId: string): Promise<boolean> {
  const project = await ownershipRepository.findProjectForOwnership(projectId)
  return project?.userId === userId
}

// Helper to verify user owns the episode's project
export async function verifyEpisodeOwnership(userId: string, episodeId: string): Promise<boolean> {
  const episode = await ownershipRepository.findEpisodeWithProjectUser(episodeId)
  return episode?.project.userId === userId
}

// Helper to verify user owns the episode scene's project（场次 Scene）
export async function verifySceneOwnership(userId: string, sceneId: string): Promise<boolean> {
  const scene = await ownershipRepository.findSceneWithProjectUser(sceneId)
  return scene?.episode.project.userId === userId
}

// Helper to verify user owns the character's project
export async function verifyCharacterOwnership(userId: string, characterId: string): Promise<boolean> {
  const character = await ownershipRepository.findCharacterWithProjectUser(characterId)
  return character?.project.userId === userId
}

// Helper to verify user owns the composition's project
export async function verifyCompositionOwnership(userId: string, compositionId: string): Promise<boolean> {
  const composition = await ownershipRepository.findCompositionWithProjectUser(compositionId)
  return composition?.project.userId === userId
}

// Helper to verify user owns the take's scene's project
export async function verifyTaskOwnership(userId: string, taskId: string): Promise<boolean> {
  const task = await ownershipRepository.findTakeWithProjectUser(taskId)
  return task?.scene.episode.project.userId === userId
}

export async function verifyLocationOwnership(userId: string, locationId: string): Promise<boolean> {
  const row = await ownershipRepository.findLocationWithProjectUser(locationId)
  return row?.project.userId === userId
}

export async function verifyCharacterImageOwnership(
  userId: string,
  characterImageId: string
): Promise<boolean> {
  const image = await ownershipRepository.findCharacterImageWithProjectUser(characterImageId)
  return image?.character.project.userId === userId
}
