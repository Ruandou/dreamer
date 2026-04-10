import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import bcrypt from 'bcrypt'

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post<{ Body: { email: string; password: string; name: string } }>(
    '/register',
    async (request, reply) => {
      const { email, password, name } = request.body

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        return reply.status(400).send({ error: 'Email already registered' })
      }

      const hashedPassword = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, name }
      })

      const accessToken = fastify.jwt.sign({ id: user.id, email: user.email })
      const refreshToken = fastify.jwt.sign(
        { id: user.id, email: user.email },
        { expiresIn: '7d' }
      )

      return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt }
      }
    }
  )

  // Login
  fastify.post<{ Body: { email: string; password: string } }>(
    '/login',
    async (request, reply) => {
      const { email, password } = request.body

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const accessToken = fastify.jwt.sign({ id: user.id, email: user.email })
      const refreshToken = fastify.jwt.sign(
        { id: user.id, email: user.email },
        { expiresIn: '7d' }
      )

      return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt }
      }
    }
  )

  // Get current user
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = (request as any).user
      const current = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true, createdAt: true }
      })
      return current
    }
  )
}
