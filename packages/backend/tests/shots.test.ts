import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const { mockVerifyShotOwnership, mockCharacterShotServiceCreateForShot } = vi.hoisted(() => {
  return {
    mockVerifyShotOwnership: vi.fn().mockResolvedValue(true),
    mockCharacterShotServiceCreateForShot: vi.fn()
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  verifyShotOwnership: (...args: unknown[]) => mockVerifyShotOwnership(...args),
  getRequestUser: (request: any) => request.user,
  getRequestUserId: (request: any) => request.user?.id
}))

vi.mock('../src/services/character-shot-service.js', () => ({
  characterShotService: {
    createForShot: (...args: unknown[]) => mockCharacterShotServiceCreateForShot(...args)
  }
}))

import { shotRoutes } from '../src/routes/shots.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Shot Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    app.decorate('authenticate', async (request: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    await app.register(shotRoutes, { prefix: '/api/shots' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /:shotId/character-shots', () => {
    it('should return 403 when user does not own shot', async () => {
      mockVerifyShotOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'POST',
        url: '/api/shots/shot-1/character-shots',
        payload: { characterImageId: 'img-1' }
      })

      expectPermissionDeniedPayload(response)
      expect(mockVerifyShotOwnership).toHaveBeenCalledWith('test-user-id', 'shot-1')
    })

    it('should return 400 when characterImageId is empty', async () => {
      mockVerifyShotOwnership.mockResolvedValueOnce(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/shots/shot-1/character-shots',
        payload: { characterImageId: '' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('characterImageId required')
    })

    it('should return 400 when characterImageId is only whitespace', async () => {
      mockVerifyShotOwnership.mockResolvedValueOnce(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/shots/shot-1/character-shots',
        payload: { characterImageId: '   ' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('characterImageId required')
    })

    it('should return 201 when character shot created successfully', async () => {
      mockVerifyShotOwnership.mockResolvedValueOnce(true)
      const mockCharacterShot = {
        id: 'cs-1',
        shotId: 'shot-1',
        characterImageId: 'img-1',
        action: null,
        characterImage: {
          id: 'img-1',
          character: { id: 'char-1', name: 'Test Character' }
        }
      }
      mockCharacterShotServiceCreateForShot.mockResolvedValueOnce({
        ok: true,
        characterShot: mockCharacterShot
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/shots/shot-1/character-shots',
        payload: { characterImageId: 'img-1' }
      })

      expect(response.statusCode).toBe(201)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('cs-1')
      expect(data.shotId).toBe('shot-1')
      expect(data.characterImageId).toBe('img-1')
      expect(mockCharacterShotServiceCreateForShot).toHaveBeenCalledWith(
        'shot-1',
        'img-1',
        undefined
      )
    })

    it('should return 201 when character shot created with action', async () => {
      mockVerifyShotOwnership.mockResolvedValueOnce(true)
      const mockCharacterShot = {
        id: 'cs-1',
        shotId: 'shot-1',
        characterImageId: 'img-1',
        action: 'wave',
        characterImage: {
          id: 'img-1',
          character: { id: 'char-1', name: 'Test Character' }
        }
      }
      mockCharacterShotServiceCreateForShot.mockResolvedValueOnce({
        ok: true,
        characterShot: mockCharacterShot
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/shots/shot-1/character-shots',
        payload: { characterImageId: 'img-1', action: 'wave' }
      })

      expect(response.statusCode).toBe(201)
      expect(mockCharacterShotServiceCreateForShot).toHaveBeenCalledWith('shot-1', 'img-1', 'wave')
    })

    it('should return 404 when shot not found', async () => {
      mockVerifyShotOwnership.mockResolvedValueOnce(true)
      mockCharacterShotServiceCreateForShot.mockResolvedValueOnce({
        ok: false,
        reason: 'shot_not_found'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/shots/shot-1/character-shots',
        payload: { characterImageId: 'img-1' }
      })

      expect(response.statusCode).toBe(404)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Shot not found')
    })

    it('should return 404 when character image not found', async () => {
      mockVerifyShotOwnership.mockResolvedValueOnce(true)
      mockCharacterShotServiceCreateForShot.mockResolvedValueOnce({
        ok: false,
        reason: 'image_not_found'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/shots/shot-1/character-shots',
        payload: { characterImageId: 'img-1' }
      })

      expect(response.statusCode).toBe(404)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('CharacterImage not found')
    })

    it('should return 400 when project mismatch', async () => {
      mockVerifyShotOwnership.mockResolvedValueOnce(true)
      mockCharacterShotServiceCreateForShot.mockResolvedValueOnce({
        ok: false,
        reason: 'project_mismatch'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/shots/shot-1/character-shots',
        payload: { characterImageId: 'img-1' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('形象不属于该剧集项目')
    })

    it('should return 409 when duplicate character shot', async () => {
      mockVerifyShotOwnership.mockResolvedValueOnce(true)
      mockCharacterShotServiceCreateForShot.mockResolvedValueOnce({
        ok: false,
        reason: 'duplicate'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/shots/shot-1/character-shots',
        payload: { characterImageId: 'img-1' }
      })

      expect(response.statusCode).toBe(409)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('该镜头已关联此形象')
    })

    it('should return 400 when create fails with unknown reason', async () => {
      mockVerifyShotOwnership.mockResolvedValueOnce(true)
      mockCharacterShotServiceCreateForShot.mockResolvedValueOnce({
        ok: false,
        reason: 'unknown' as any
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/shots/shot-1/character-shots',
        payload: { characterImageId: 'img-1' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Create failed')
    })
  })
})
