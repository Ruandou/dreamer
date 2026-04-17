import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

// Store for SSE connections per user
const sseConnections = new Map<string, FastifyReply[]>()

export function sendSSEToUser(userId: string, event: string, data: any) {
  const connections = sseConnections.get(userId) || []
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

  connections.forEach((reply) => {
    try {
      reply.raw.write(message)
    } catch (e) {
      // Connection might be closed
    }
  })
}

export function sendTaskUpdate(userId: string, taskId: string, status: string, data: any) {
  sendSSEToUser(userId, 'task-update', {
    taskId,
    status,
    ...data
  })
}

export function sendProjectUpdate(userId: string, projectId: string, type: string, data: any) {
  sendSSEToUser(userId, 'project-update', {
    projectId,
    type,
    ...data
  })
}

declare module 'fastify' {
  interface FastifyInstance {
    sse: {
      subscribe: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
      sendToUser: (userId: string, event: string, data: any) => void
    }
  }
}

export const ssePlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorate('sse', {
    subscribe: async function (request: FastifyRequest, reply: FastifyReply) {
      // Get user from JWT token in Authorization header or query param
      let userId = 'anonymous'
      try {
        // Try to get token from query string for SSE
        const token =
          (request.query as any)?.subscribe || request.headers.authorization?.replace('Bearer ', '')
        if (token) {
          const decoded = await fastify.jwt.verify(token)
          userId = (decoded as any).id || 'anonymous'
        }
      } catch (e) {
        // Allow anonymous SSE connections for public updates
      }

      // Set headers for SSE
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      })

      // Add to connections map
      if (!sseConnections.has(userId)) {
        sseConnections.set(userId, [])
      }
      sseConnections.get(userId)!.push(reply)

      // Send initial connection message
      reply.raw.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`)

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(': heartbeat\n\n')
        } catch (e) {
          clearInterval(heartbeat)
        }
      }, 30000)

      // Cleanup on close
      request.raw.on('close', () => {
        clearInterval(heartbeat)
        const connections = sseConnections.get(userId)
        if (connections) {
          const index = connections.indexOf(reply)
          if (index !== -1) {
            connections.splice(index, 1)
          }
          if (connections.length === 0) {
            sseConnections.delete(userId)
          }
        }
      })
    },

    sendToUser: (userId: string, event: string, data: any) => {
      sendSSEToUser(userId, event, data)
    }
  })
})
