import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { authPlugin } from '../../src/plugins/auth.js'
import { ssePlugin } from '../../src/plugins/sse.js'
import { authRoutes } from '../../src/routes/auth.js'
import { projectRoutes } from '../../src/routes/projects.js'
import { episodeRoutes } from '../../src/routes/episodes.js'
import { characterRoutes } from '../../src/routes/characters.js'
import { characterImageRoutes } from '../../src/routes/character-images.js'
import { locationRoutes } from '../../src/routes/locations.js'
import { takeRoutes } from '../../src/routes/takes.js'
import { sceneRoutes } from '../../src/routes/scenes.js'
import { shotRoutes } from '../../src/routes/shots.js'
import { characterShotsRoutes } from '../../src/routes/character-shots.js'
import { taskRoutes } from '../../src/routes/tasks.js'
import { compositionRoutes } from '../../src/routes/compositions.js'
import { statsRoutes } from '../../src/routes/stats.js'
import { importRoutes } from '../../src/routes/import.js'
import { settingsRoutes } from '../../src/routes/settings.js'
import { pipelineRoutes } from '../../src/routes/pipeline.js'
import { imageGenerationJobRoutes } from '../../src/routes/image-generation-jobs.js'
import { modelApiCallRoutes } from '../../src/routes/model-api-calls.js'
import { memoryRoutes } from '../../src/routes/memories.js'
import { tasksUnifiedRoutes } from '../../src/routes/tasks-unified.js'
import { scriptsRoutes } from '../../src/routes/scripts.js'
import { chatRoutes } from '../../src/routes/chat.js'
import { scriptAgentRoutes } from '../../src/routes/script-agent.js'
import type { FastifyInstance } from 'fastify'

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, requestTimeout: 30000, connectionTimeout: 0 })

  await app.register(cors, { origin: true, credentials: true })
  await app.register(jwt, { secret: 'test-jwt-secret-not-for-production' })
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } })
  await app.register(ssePlugin)

  app.get('/api/sse', async (request, reply) => {
    await app.sse.subscribe(request, reply)
  })

  await app.register(authPlugin)

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(projectRoutes, { prefix: '/api/projects' })
  await app.register(episodeRoutes, { prefix: '/api/episodes' })
  await app.register(characterRoutes, { prefix: '/api/characters' })
  await app.register(characterImageRoutes, { prefix: '/api/character-images' })
  await app.register(locationRoutes, { prefix: '/api/locations' })
  await app.register(takeRoutes, { prefix: '/api/takes' })
  await app.register(sceneRoutes, { prefix: '/api/scenes' })
  await app.register(shotRoutes, { prefix: '/api/shots' })
  await app.register(characterShotsRoutes, { prefix: '/api/character-shots' })
  await app.register(taskRoutes, { prefix: '/api/tasks' })
  await app.register(compositionRoutes, { prefix: '/api/compositions' })
  await app.register(statsRoutes, { prefix: '/api/stats' })
  await app.register(importRoutes, { prefix: '/api/import' })
  await app.register(settingsRoutes, { prefix: '/api/settings' })
  await app.register(pipelineRoutes, { prefix: '/api/pipeline' })
  await app.register(imageGenerationJobRoutes, { prefix: '/api/image-generation' })
  await app.register(modelApiCallRoutes, { prefix: '/api/model-api-calls' })
  await app.register(memoryRoutes, { prefix: '/api/projects' })
  await app.register(tasksUnifiedRoutes, { prefix: '/api/tasks' })
  await app.register(scriptsRoutes, { prefix: '/api/scripts' })
  await app.register(chatRoutes, { prefix: '/api/chat' })
  await app.register(scriptAgentRoutes, { prefix: '/api/scripts' })

  app.get('/health', async () => ({ status: 'ok' }))

  await app.ready()
  return app
}
