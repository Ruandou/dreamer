import { config } from 'dotenv'
// Load .env from project root BEFORE any other imports that depend on env vars
config({ path: '../../.env' })

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { PrismaClient } from '@prisma/client'
import { authPlugin } from './plugins/auth.js'
import { ssePlugin } from './plugins/sse.js'
import { projectRoutes } from './routes/projects.js'
import { episodeRoutes } from './routes/episodes.js'
import { characterRoutes } from './routes/characters.js'
import { sceneRoutes } from './routes/scenes.js'
import { taskRoutes } from './routes/tasks.js'
import { compositionRoutes } from './routes/compositions.js'
import { authRoutes } from './routes/auth.js'
import { statsRoutes } from './routes/stats.js'
import { importRoutes } from './routes/import.js'
import { settingsRoutes } from './routes/settings.js'

// Initialize Prisma with explicit DATABASE_URL
export const prisma = new PrismaClient()

const fastify = Fastify({
  logger: true
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
    await fastify.register(sceneRoutes, { prefix: '/api/scenes' })
    await fastify.register(taskRoutes, { prefix: '/api/tasks' })
    await fastify.register(compositionRoutes, { prefix: '/api/compositions' })
    await fastify.register(statsRoutes, { prefix: '/api/stats' })
    await fastify.register(importRoutes, { prefix: '/api/import' })
    await fastify.register(settingsRoutes, { prefix: '/api/settings' })

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
