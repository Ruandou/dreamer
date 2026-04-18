/** 勿删、勿后移：须为全文件第一个 import，否则 ESM 下 ARK_* 等会在 dotenv 之前被读成空 */
import './bootstrap-env.js'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import _staticFiles from '@fastify/static' // TODO: 未使用，待删除
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { authPlugin } from './plugins/auth.js'
import { ssePlugin } from './plugins/sse.js'
import { projectRoutes } from './routes/projects.js'
import { episodeRoutes } from './routes/episodes.js'
import { characterRoutes } from './routes/characters.js'
import { characterImageRoutes } from './routes/character-images.js'
import { locationRoutes } from './routes/locations.js'
import { takeRoutes } from './routes/takes.js'
import { sceneRoutes } from './routes/scenes.js'
import { shotRoutes } from './routes/shots.js'
import { characterShotsRoutes } from './routes/character-shots.js'
import { taskRoutes } from './routes/tasks.js'
import { compositionRoutes } from './routes/compositions.js'
import { authRoutes } from './routes/auth.js'
import { statsRoutes } from './routes/stats.js'
import { importRoutes } from './routes/import.js'
import { settingsRoutes } from './routes/settings.js'
import { pipelineRoutes } from './routes/pipeline.js'
import { imageGenerationJobRoutes } from './routes/image-generation-jobs.js'
import { modelApiCallRoutes } from './routes/model-api-calls.js'
import { memoryRoutes } from './routes/memories.js'

export { prisma } from './lib/prisma.js'

const fastify = Fastify({
  logger: true,
  // 设置请求超时时间为 30 秒（仅用于防止僵尸连接）
  // 异步任务应立即返回 jobId，不应受此限制
  requestTimeout: 30000,
  // 连接超时
  connectionTimeout: 0 // 0 = 无限制（用于长连接/SSE）
})

async function start() {
  try {
    // Register plugins
    // CORS 配置：生产环境应设置具体域名
    const corsOrigin = process.env.CORS_ORIGIN || true
    await fastify.register(cors, {
      origin: corsOrigin,
      credentials: true
    })

    await fastify.register(jwt, {
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key'
    })

    await fastify.register(multipart, {
      limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
      }
    })

    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'Dreamer API',
          version: '0.1.0'
        }
      }
    })

    await fastify.register(swaggerUI, {
      routePrefix: '/docs'
    })

    // Register SSE plugin and routes
    await fastify.register(ssePlugin)

    // SSE endpoint
    fastify.get('/api/sse', async (request, reply) => {
      await fastify.sse.subscribe(request, reply)
    })

    // Register auth plugin
    await fastify.register(authPlugin)

    // Register routes
    await fastify.register(authRoutes, { prefix: '/api/auth' })
    await fastify.register(projectRoutes, { prefix: '/api/projects' })
    await fastify.register(episodeRoutes, { prefix: '/api/episodes' })
    await fastify.register(characterRoutes, { prefix: '/api/characters' })
    await fastify.register(characterImageRoutes, {
      prefix: '/api/character-images'
    })
    await fastify.register(locationRoutes, { prefix: '/api/locations' })
    await fastify.register(takeRoutes, { prefix: '/api/takes' })
    await fastify.register(sceneRoutes, { prefix: '/api/scenes' })
    await fastify.register(shotRoutes, { prefix: '/api/shots' })
    await fastify.register(characterShotsRoutes, {
      prefix: '/api/character-shots'
    })
    await fastify.register(taskRoutes, { prefix: '/api/tasks' })
    await fastify.register(compositionRoutes, { prefix: '/api/compositions' })
    await fastify.register(statsRoutes, { prefix: '/api/stats' })
    await fastify.register(importRoutes, { prefix: '/api/import' })
    await fastify.register(settingsRoutes, { prefix: '/api/settings' })
    await fastify.register(pipelineRoutes, { prefix: '/api/pipeline' })
    await fastify.register(imageGenerationJobRoutes, {
      prefix: '/api/image-generation'
    })
    await fastify.register(modelApiCallRoutes, {
      prefix: '/api/model-api-calls'
    })
    await fastify.register(memoryRoutes, { prefix: '/api/projects' })

    // Health check
    fastify.get('/health', async () => ({ status: 'ok' }))

    // Start server
    await fastify.listen({ port: 4000, host: '0.0.0.0' })
    console.log('Server running at http://localhost:4000')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// Only start server when running directly (not when imported as a module)
const isMainModule = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')
if (isMainModule) {
  start()
}
