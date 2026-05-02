import { FastifyInstance } from 'fastify'
import { getRequestUserId } from '../plugins/auth.js'
import { verifyEpisodeOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { callLLMWithRetry } from '../services/ai/llm-call-wrapper.js'
import { getDefaultProvider } from '../services/ai/llm-factory.js'
import {
  buildDramaPrompt,
  type DramaCommand,
  type DramaPromptContext
} from '../services/ai/drama-prompts.js'
import { prisma } from '../lib/prisma.js'

export async function aiDramaRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Params: { id: string }
    Body: {
      command: DramaCommand
    }
  }>('/episodes/:id/ai-drama', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getRequestUserId(request)
    const episodeId = request.params.id
    const { command } = request.body

    if (!(await verifyEpisodeOwnership(userId, episodeId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    // Fetch episode with project context
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        project: {
          include: {
            characters: true
          }
        }
      }
    })

    if (!episode) {
      return reply.status(404).send({ error: 'Episode not found' })
    }

    const characters = episode.project.characters.map((c) => ({
      name: c.name,
      personality: c.personality || undefined,
      relationship: c.relationship || undefined
    }))

    const context: DramaPromptContext = {
      content: episode.content || '',
      protagonistName: episode.project.name,
      characters,
      episodeHook: episode.hook || undefined,
      episodeCliffhanger: episode.cliffhanger || undefined,
      templateName: episode.project.templateId || undefined
    }

    const prompt = buildDramaPrompt(command, context)
    const provider = getDefaultProvider()

    try {
      const result = await callLLMWithRetry(
        {
          provider,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          maxTokens: 4000,
          modelLog: {
            userId,
            projectId: episode.projectId,
            op: `ai_drama_${command}`
          }
        },
        (content) => content
      )

      return {
        content: result.content,
        command,
        cost: result.cost
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return reply.status(500).send({ error: `AI 生成失败：${message}` })
    }
  })
}
