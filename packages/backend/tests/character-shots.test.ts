import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const {
  mockVerifyCharacterShotOwnership,
  mockCharacterShotServiceUpdateCharacterImage
} = vi.hoisted(() => {
  return {
    mockVerifyCharacterShotOwnership: vi.fn().mockResolvedValue(true),
    mockCharacterShotServiceUpdateCharacterImage: vi.fn()
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  verifyCharacterShotOwnership: (...args: unknown[]) => mockVerifyCharacterShotOwnership(...args)
}))

vi.mock('../src/services/character-shot-service.js', () => ({
  characterShotService: {
    updateCharacterImage: (...args: unknown[]) => mockCharacterShotServiceUpdateCharacterImage(...args)
  }
}))

import { characterShotsRoutes } from '../src/routes/character-shots.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Character Shot Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    app.decorate('authenticate', async (request: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    await app.register(characterShotsRoutes, { prefix: '/api/character-shots' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PATCH /:id', () => {
    it('should return 403 when user does not own character shot', async () => {
      mockVerifyCharacterShotOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/character-shots/cs-1',
        payload: { characterImageId: 'img-2' }
      })

      expectPermissionDeniedPayload(response)
      expect(mockVerifyCharacterShotOwnership).toHaveBeenCalledWith('test-user-id', 'cs-1')
    })

    it('should return 400 when characterImageId is empty', async () => {
      mockVerifyCharacterShotOwnership.mockResolvedValueOnce(true)

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/character-shots/cs-1',
        payload: { characterImageId: '' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('characterImageId required')
    })

    it('should return 400 when characterImageId is only whitespace', async () => {
      mockVerifyCharacterShotOwnership.mockResolvedValueOnce(true)

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/character-shots/cs-1',
        payload: { characterImageId: '   ' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('characterImageId required')
    })

    it('should return 200 when character shot updated successfully', async () => {
      mockVerifyCharacterShotOwnership.mockResolvedValueOnce(true)
      const mockCharacterShot = {
        id: 'cs-1',
        shotId: 'shot-1',
        characterImageId: 'img-2',
        action: null,
        characterImage: {
          id: 'img-2',
          character: { id: 'char-1', name: 'Test Character' }
        }
      }
      mockCharacterShotServiceUpdateCharacterImage.mockResolvedValueOnce({
        ok: true,
        characterShot: mockCharacterShot
      })

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/character-shots/cs-1',
        payload: { characterImageId: 'img-2' }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('cs-1')
      expect(data.characterImageId).toBe('img-2')
      expect(mockCharacterShotServiceUpdateCharacterImage).toHaveBeenCalledWith('cs-1', 'img-2')
    })

    it('should return 404 when character shot not found', async () => {
      mockVerifyCharacterShotOwnership.mockResolvedValueOnce(true)
      mockCharacterShotServiceUpdateCharacterImage.mockResolvedValueOnce({
        ok: false,
        reason: 'not_found'
      })

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/character-shots/cs-1',
        payload: { characterImageId: 'img-2' }
      })

      expect(response.statusCode).toBe(404)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('CharacterShot not found')
    })

    it('should return 404 when character image not found', async () => {
      mockVerifyCharacterShotOwnership.mockResolvedValueOnce(true)
      mockCharacterShotServiceUpdateCharacterImage.mockResolvedValueOnce({
        ok: false,
        reason: 'image_not_found'
      })

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/character-shots/cs-1',
        payload: { characterImageId: 'img-2' }
      })

      expect(response.statusCode).toBe(404)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('CharacterImage not found')
    })

    it('should return 400 when character mismatch', async () => {
      mockVerifyCharacterShotOwnership.mockResolvedValueOnce(true)
      mockCharacterShotServiceUpdateCharacterImage.mockResolvedValueOnce({
        ok: false,
        reason: 'character_mismatch'
      })

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/character-shots/cs-1',
        payload: { characterImageId: 'img-2' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('形象必须属于该镜头中的同一角色')
    })

    it('should return 400 when update fails with unknown reason', async () => {
      mockVerifyCharacterShotOwnership.mockResolvedValueOnce(true)
      mockCharacterShotServiceUpdateCharacterImage.mockResolvedValueOnce({
        ok: false,
        reason: 'unknown' as any
      })

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/character-shots/cs-1',
        payload: { characterImageId: 'img-2' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Update failed')
    })
  })
})
