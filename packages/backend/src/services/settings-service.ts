import type { Prisma } from '@prisma/client'
import { getDeepSeekBalance } from './deepseek.js'
import { settingsRepository, type SettingsRepository } from '../repositories/settings-repository.js'

export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  async getMePayload(userId: string) {
    const dbUser = await this.repo.findUserForSettings(userId)

    if (!dbUser) {
      return { error: 'User not found' as const }
    }

    const hasApiKey = !!dbUser.apiKey

    let balance = null
    let balanceError = null
    if (dbUser.apiKey) {
      try {
        const originalKey = process.env.DEEPSEEK_API_KEY
        process.env.DEEPSEEK_API_KEY = dbUser.apiKey
        balance = await getDeepSeekBalance()
        process.env.DEEPSEEK_API_KEY = originalKey
      } catch (error: unknown) {
        balanceError = error instanceof Error ? error.message : String(error)
        balance = null
      }
    }

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        createdAt: dbUser.createdAt
      },
      hasApiKey,
      balance,
      balanceError,
      apiKeys: {
        deepseekApiUrl: dbUser.deepseekApiUrl,
        atlasApiKey: dbUser.atlasApiKey,
        atlasApiUrl: dbUser.atlasApiUrl,
        arkApiKey: dbUser.arkApiKey,
        arkApiUrl: dbUser.arkApiUrl
      }
    }
  }

  async updateMe(
    userId: string,
    body: {
      name?: string
      apiKey?: string
      apiKeys?: {
        deepseekApiUrl?: string
        atlasApiKey?: string
        atlasApiUrl?: string
        arkApiKey?: string
        arkApiUrl?: string
      }
    }
  ) {
    const { name, apiKey, apiKeys } = body

    const updateData: Prisma.UserUpdateInput = {}
    if (name) updateData.name = name
    if (apiKey !== undefined) updateData.apiKey = apiKey || null
    if (apiKeys) {
      if (apiKeys.deepseekApiUrl !== undefined) {
        updateData.deepseekApiUrl = apiKeys.deepseekApiUrl || null
      }
      if (apiKeys.atlasApiKey !== undefined) updateData.atlasApiKey = apiKeys.atlasApiKey || null
      if (apiKeys.atlasApiUrl !== undefined) updateData.atlasApiUrl = apiKeys.atlasApiUrl || null
      if (apiKeys.arkApiKey !== undefined) updateData.arkApiKey = apiKeys.arkApiKey || null
      if (apiKeys.arkApiUrl !== undefined) updateData.arkApiUrl = apiKeys.arkApiUrl || null
    }

    const updatedUser = await this.repo.updateUser(userId, updateData)

    return {
      success: true as const,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        hasApiKey: !!updatedUser.apiKey
      }
    }
  }

  async verifyApiKey(apiKey: string) {
    if (!apiKey) {
      return { ok: false as const, empty: true as const }
    }

    try {
      const originalKey = process.env.DEEPSEEK_API_KEY
      process.env.DEEPSEEK_API_KEY = apiKey
      const balance = await getDeepSeekBalance()
      process.env.DEEPSEEK_API_KEY = originalKey

      return { ok: true as const, balance }
    } catch (error: unknown) {
      process.env.DEEPSEEK_API_KEY = ''
      return {
        ok: false as const,
        empty: false as const,
        error: error instanceof Error ? error.message : 'API Key 验证失败'
      }
    }
  }
}

export const settingsService = new SettingsService(settingsRepository)
