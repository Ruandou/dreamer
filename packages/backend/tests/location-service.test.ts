import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Location, Project } from '@prisma/client'
import { LocationService, type ImageQueueAdapter } from '../src/services/location-service.js'
import { LocationRepository } from '../src/repositories/location-repository.js'

const mockFindManyWithProject = vi.fn()
const mockFindFirstActiveById = vi.fn()
const mockUpdate = vi.fn()
const mockAdd = vi.fn()
const mockCreateActive = vi.fn()

function makeMockRepository(): LocationRepository {
  return {
    findManyByProjectOrdered: vi.fn(),
    findManyWithProjectForBatch: mockFindManyWithProject,
    findFirstActiveById: mockFindFirstActiveById,
    findFirstActiveWithProjectById: vi.fn(),
    update: mockUpdate,
    createActive: mockCreateActive,
    unlinkScenesFromLocation: vi.fn(),
    softDelete: vi.fn()
  } as unknown as LocationRepository
}

const mockQueue: ImageQueueAdapter = {
  add: (...args) => mockAdd(...args) as Promise<{ id?: string | null }>
}

describe('LocationService', () => {
  let service: LocationService

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdd.mockResolvedValue({ id: 'job-1' })
    mockCreateActive.mockReset()
    service = new LocationService(makeMockRepository(), mockQueue)
  })

  it('batchEnqueueEstablishingImages skips locations that already have an image', async () => {
    mockFindManyWithProject.mockResolvedValue([
      {
        id: 'l1',
        name: 'A',
        imageUrl: 'https://x',
        imagePrompt: 'p',
        projectId: 'p1',
        project: { id: 'p1' } as Project
      } as Location & { project: Project }
    ])

    const r = await service.batchEnqueueEstablishingImages('u1', 'p1')

    expect(r.enqueued).toBe(0)
    expect(r.skipped[0].reason).toBe('已有定场图')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('batchEnqueueEstablishingImages enqueues when prompt exists and no image', async () => {
    mockFindManyWithProject.mockResolvedValue([
      {
        id: 'l1',
        name: 'Cafe',
        imageUrl: null,
        imagePrompt: 'warm interior',
        projectId: 'p1',
        project: { id: 'p1' } as Project
      } as Location & { project: Project }
    ])

    const r = await service.batchEnqueueEstablishingImages('u1', 'p1')

    expect(r.enqueued).toBe(1)
    expect(mockAdd).toHaveBeenCalledWith(
      'location-establishing',
      expect.objectContaining({
        kind: 'location_establishing',
        locationId: 'l1',
        prompt: expect.stringContaining('Cafe establishing shot')
      })
    )
  })

  it('deleteLocation returns false when location missing', async () => {
    mockFindFirstActiveById.mockResolvedValue(null)
    service = new LocationService(makeMockRepository(), mockQueue)
    await expect(service.deleteLocation('missing')).resolves.toBe(false)
  })

  it('createManual returns empty_name when name is blank', async () => {
    await expect(service.createManual('p1', { name: '   ' })).resolves.toEqual({
      ok: false,
      reason: 'empty_name'
    })
    expect(mockCreateActive).not.toHaveBeenCalled()
  })

  it('createManual creates with default timeOfDay 日', async () => {
    mockCreateActive.mockResolvedValue({ id: 'l-new', name: '天台', projectId: 'p1' })
    const r = await service.createManual('p1', { name: ' 天台 ', description: null })
    expect(r.ok).toBe(true)
    expect(mockCreateActive).toHaveBeenCalledWith({
      projectId: 'p1',
      name: '天台',
      timeOfDay: '日',
      description: null
    })
  })

  it('createManual returns duplicate_name on Prisma P2002', async () => {
    mockCreateActive.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    const r = await service.createManual('p1', { name: '重复' })
    expect(r).toEqual({ ok: false, reason: 'duplicate_name' })
  })
})
