import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsService } from '../src/services/settings-service.js'
import { getDeepSeekBalance } from '../src/services/ai/deepseek.js'

vi.mock('../src/services/ai/deepseek.js', () => ({
  getDeepSeekBalance: vi.fn()
}))

describe('SettingsService', () => {
  const mockRepo = {
    findUserForSettings: vi.fn(),
    updateUser: vi.fn()
  }

  const service = new SettingsService(mockRepo as any)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getMePayload', () => {
    it('returns error when user not found', async () => {
      mockRepo.findUserForSettings.mockResolvedValue(null)
      const result = await service.getMePayload('user-1')
      expect(result.error).toBe('User not found')
    })

    it('returns user without apiKey', async () => {
      mockRepo.findUserForSettings.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        apiKey: null,
        createdAt: new Date(),
        deepseekApiUrl: null,
        atlasApiKey: null,
        atlasApiUrl: null,
        arkApiKey: null,
        arkApiUrl: null
      })
      const result = await service.getMePayload('user-1')
      expect(result.hasApiKey).toBe(false)
      expect(result.balance).toBeNull()
    })

    it('fetches balance when apiKey exists', async () => {
      mockRepo.findUserForSettings.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        apiKey: 'key-123',
        createdAt: new Date(),
        deepseekApiUrl: null,
        atlasApiKey: null,
        atlasApiUrl: null,
        arkApiKey: null,
        arkApiUrl: null
      })
      vi.mocked(getDeepSeekBalance).mockResolvedValue({ isAvailable: true, balanceInfos: [] })
      const result = await service.getMePayload('user-1')
      expect(result.hasApiKey).toBe(true)
      expect(result.balance).toEqual({ isAvailable: true, balanceInfos: [] })
    })

    it('handles balance fetch error', async () => {
      mockRepo.findUserForSettings.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        apiKey: 'key-123',
        createdAt: new Date(),
        deepseekApiUrl: null,
        atlasApiKey: null,
        atlasApiUrl: null,
        arkApiKey: null,
        arkApiUrl: null
      })
      vi.mocked(getDeepSeekBalance).mockRejectedValue(new Error('Network error'))
      const result = await service.getMePayload('user-1')
      expect(result.balance).toBeNull()
      expect(result.balanceError).toBe('Network error')
    })
  })

  describe('updateMe', () => {
    it('updates name only', async () => {
      mockRepo.updateUser.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'New Name',
        apiKey: null
      })
      const result = await service.updateMe('user-1', { name: 'New Name' })
      expect(result.success).toBe(true)
      expect(result.user.name).toBe('New Name')
    })

    it('updates apiKey to null when empty string', async () => {
      mockRepo.updateUser.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        apiKey: null
      })
      await service.updateMe('user-1', { apiKey: '' })
      expect(mockRepo.updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ apiKey: null })
      )
    })

    it('updates apiKeys', async () => {
      mockRepo.updateUser.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        apiKey: null
      })
      await service.updateMe('user-1', {
        apiKeys: {
          deepseekApiUrl: 'http://api.test',
          atlasApiKey: 'atlas-key',
          atlasApiUrl: undefined,
          arkApiKey: undefined,
          arkApiUrl: undefined
        }
      })
      expect(mockRepo.updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          deepseekApiUrl: 'http://api.test',
          atlasApiKey: 'atlas-key'
        })
      )
    })
  })

  describe('verifyApiKey', () => {
    it('returns empty for missing key', async () => {
      const result = await service.verifyApiKey('')
      expect(result.ok).toBe(false)
      expect(result.empty).toBe(true)
    })

    it('returns ok for valid key', async () => {
      vi.mocked(getDeepSeekBalance).mockResolvedValue({ isAvailable: true, balanceInfos: [] })
      const result = await service.verifyApiKey('valid-key')
      expect(result.ok).toBe(true)
      expect(result.balance).toEqual({ isAvailable: true, balanceInfos: [] })
    })

    it('returns error for invalid key', async () => {
      vi.mocked(getDeepSeekBalance).mockRejectedValue(new Error('Invalid key'))
      const result = await service.verifyApiKey('invalid-key')
      expect(result.ok).toBe(false)
      expect(result.error).toBe('Invalid key')
    })
  })
})
