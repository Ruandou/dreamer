import type { Take } from '@prisma/client'
import { takeRepository, type TakeRepository } from '../repositories/take-repository.js'

export class TakeService {
  constructor(private readonly repository: TakeRepository) {}

  async selectTakeAsCurrent(takeId: string): Promise<{ ok: true; task: Take } | { ok: false; reason: 'not_found' }> {
    const existing = await this.repository.findById(takeId)
    if (!existing) {
      return { ok: false, reason: 'not_found' }
    }

    await this.repository.clearSelectionForScene(existing.sceneId)
    const task = await this.repository.setSelected(takeId)
    return { ok: true, task }
  }
}

export const takeService = new TakeService(takeRepository)
