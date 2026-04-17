import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const { mockVerifyTaskOwnership, mockTakeFindUnique, mockTakeUpdateMany, mockTakeUpdate } =
  vi.hoisted(() => ({
    mockVerifyTaskOwnership: vi.fn().mockResolvedValue(true),
    mockTakeFindUnique: vi.fn(),
    mockTakeUpdateMany: vi.fn(),
    mockTakeUpdate: vi.fn()
  }))

vi.mock('../src/plugins/auth.js', () => ({
  verifyTaskOwnership: (...args: unknown[]) => mockVerifyTaskOwnership(...args)
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    take: {
      findUnique: mockTakeFindUnique,
      updateMany: mockTakeUpdateMany,
      update: mockTakeUpdate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import { takeRoutes } from '../src/routes/takes.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Take routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('authenticate', async (request: any) => {
      request.user = { id: 'u1', email: 'a@b.c' }
    })
    await app.register(takeRoutes, { prefix: '/api/takes' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyTaskOwnership.mockResolvedValue(true)
  })

  it('PATCH select clears others and selects take', async () => {
    mockTakeFindUnique.mockResolvedValue({ id: 't1', sceneId: 's1' })
    mockTakeUpdate.mockResolvedValue({ id: 't1', isSelected: true })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/takes/t1/select'
    })

    expect(res.statusCode).toBe(200)
    expect(mockTakeUpdateMany).toHaveBeenCalledWith({
      where: { sceneId: 's1' },
      data: { isSelected: false }
    })
    expect(mockTakeUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { isSelected: true }
    })
  })

  it('returns 403 when not owner', async () => {
    mockVerifyTaskOwnership.mockResolvedValueOnce(false)
    const res = await app.inject({ method: 'PATCH', url: '/api/takes/t1/select' })
    expectPermissionDeniedPayload(res)
  })
})
