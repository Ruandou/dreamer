import type { Prisma } from '@prisma/client'
import type { ImageGenerationJobData } from '@dreamer/shared/types'
import { imageQueue } from '../queues/image.js'
import { sanitizeLocationImagePromptForImageApi } from './script-visual-enrich.js'
import { locationRepository, type LocationRepository } from '../repositories/location-repository.js'
import {
  buildLocationEstablishingPrompt,
  locationHasEstablishingImage
} from '../lib/location-establishing-prompt.js'

export interface ImageQueueAdapter {
  add(name: string, data: ImageGenerationJobData): Promise<{ id?: string | null }>
}

export interface BatchEstablishingResult {
  jobIds: string[]
  enqueuedLocationIds: string[]
  skipped: { id: string; name: string; reason: string }[]
  enqueued: number
}

export class LocationService {
  constructor(
    private readonly repository: LocationRepository,
    private readonly queue: ImageQueueAdapter
  ) {}

  listByProject(projectId: string) {
    return this.repository.findManyByProjectOrdered(projectId)
  }

  /**
   * Manually add a location.
   *
   * Name must be non-empty after trim, and must not duplicate an existing
   * active location in the same project.
   */
  async createManual(
    projectId: string,
    body: { name: string; timeOfDay?: string | null; description?: string | null }
  ): Promise<
    | { ok: true; location: Awaited<ReturnType<LocationRepository['createActive']>> }
    | { ok: false; reason: 'empty_name' | 'duplicate_name' }
  > {
    const name = (body.name ?? '').trim()
    if (!name) {
      return { ok: false, reason: 'empty_name' }
    }
    const timeRaw = body.timeOfDay != null ? String(body.timeOfDay).trim() : ''
    const timeOfDay = timeRaw || '日'
    const descriptionRaw = body.description != null ? String(body.description).trim() : ''
    const description = descriptionRaw || null
    try {
      const location = await this.repository.createActive({
        projectId,
        name,
        timeOfDay,
        description
      })
      return { ok: true, location }
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return { ok: false, reason: 'duplicate_name' }
      }
      throw error
    }
  }

  findActiveById(locationId: string) {
    return this.repository.findFirstActiveById(locationId)
  }

  updateFields(locationId: string, data: Prisma.LocationUpdateInput) {
    return this.repository.update(locationId, data)
  }

  async batchEnqueueEstablishingImages(
    userId: string,
    projectId: string,
    promptOverrides?: Record<string, string>
  ): Promise<BatchEstablishingResult> {
    const rows = await this.repository.findManyWithProjectForBatch(projectId)

    const jobIds: string[] = []
    const enqueuedLocationIds: string[] = []
    const skipped: { id: string; name: string; reason: string }[] = []

    for (const location of rows) {
      if (locationHasEstablishingImage(location.imageUrl)) {
        skipped.push({ id: location.id, name: location.name, reason: '已有定场图' })
        continue
      }
      const override = promptOverrides?.[location.id]
      const effectiveRaw =
        override !== undefined ? String(override).trim() : (location.imagePrompt || '').trim()
      const effective = sanitizeLocationImagePromptForImageApi(effectiveRaw)
      if (effective && effective !== (location.imagePrompt || '').trim()) {
        await this.repository.update(location.id, { imagePrompt: effective })
      }
      if (!effective) {
        skipped.push({ id: location.id, name: location.name, reason: '缺少定场图提示词' })
        continue
      }

      const establishingName = `${location.name} establishing shot, empty scene, no people, cinematic lighting`
      const finalPrompt = buildLocationEstablishingPrompt(establishingName, effective)

      const job = await this.queue.add('location-establishing', {
        kind: 'location_establishing',
        userId,
        projectId: location.projectId,
        locationId: location.id,
        prompt: finalPrompt
      })
      if (job.id) {
        jobIds.push(String(job.id))
        enqueuedLocationIds.push(location.id)
      }
    }

    return {
      jobIds,
      enqueuedLocationIds,
      skipped,
      enqueued: jobIds.length
    }
  }

  async enqueueEstablishingForLocation(
    userId: string,
    locationId: string,
    promptOverride?: string
  ): Promise<
    | { ok: true; jobId: string | null | undefined; kind: 'location_establishing' }
    | { ok: false; reason: 'not_found' | 'missing_prompt' }
  > {
    const location = await this.repository.findFirstActiveWithProjectById(locationId)
    if (!location) {
      return { ok: false, reason: 'not_found' }
    }

    const effectiveRaw =
      typeof promptOverride === 'string' && promptOverride.trim()
        ? promptOverride.trim()
        : (location.imagePrompt || '').trim()
    const effective = sanitizeLocationImagePromptForImageApi(effectiveRaw)

    if (effective && effective !== (location.imagePrompt || '').trim()) {
      await this.repository.update(locationId, { imagePrompt: effective })
    }

    if (!effective) {
      return { ok: false, reason: 'missing_prompt' }
    }

    const establishingName = `${location.name} establishing shot, empty scene, no people, cinematic lighting`
    const finalPrompt = buildLocationEstablishingPrompt(establishingName, effective)

    const job = await this.queue.add('location-establishing', {
      kind: 'location_establishing',
      userId,
      projectId: location.projectId,
      locationId: location.id,
      prompt: finalPrompt
    })

    return { ok: true, jobId: job.id, kind: 'location_establishing' }
  }

  async deleteLocation(locationId: string): Promise<boolean> {
    const existing = await this.repository.findFirstActiveById(locationId)
    if (!existing) {
      return false
    }
    await this.repository.unlinkScenesFromLocation(locationId)
    await this.repository.softDelete(locationId)
    return true
  }

  setUploadedImageAndClearCost(locationId: string, imageUrl: string) {
    return this.repository.update(locationId, { imageUrl, imageCost: null })
  }
}

export const locationService = new LocationService(locationRepository, imageQueue)
