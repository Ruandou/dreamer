import { FastifyInstance } from 'fastify'
import { authService } from '../services/auth-service.js'
import { getRequestUser } from '../plugins/auth.js'

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post<{ Body: { email: string; password: string; name: string } }>(
    '/register',
    async (request, reply) => {
      const { email, password, name } = request.body

      const result = await authService.register(email, password, name)
      if (!result.ok) {
        return reply.status(400).send({ error: 'Email already registered' })
      }

      const accessToken = fastify.jwt.sign({ id: result.user.id, email: result.user.email })
      const refreshToken = fastify.jwt.sign(
        { id: result.user.id, email: result.user.email },
        { expiresIn: '7d' }
      )

      return {
        accessToken,
        refreshToken,
        user: result.user
      }
    }
  )

  // Login
  fastify.post<{ Body: { email: string; password: string } }>('/login', async (request, reply) => {
    const { email, password } = request.body

    const result = await authService.login(email, password)
    if (!result.ok) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const accessToken = fastify.jwt.sign({ id: result.user.id, email: result.user.email })
    const refreshToken = fastify.jwt.sign(
      { id: result.user.id, email: result.user.email },
      { expiresIn: '7d' }
    )

    return {
      accessToken,
      refreshToken,
      user: result.user
    }
  })

  // Get current user
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = getRequestUser(request)
    return authService.getMe(user.id)
  })
}
