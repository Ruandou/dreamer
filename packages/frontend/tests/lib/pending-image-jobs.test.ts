import { describe, it, expect } from 'vitest'
import {
  inferImageJobBinding,
  buildInFlightImageJobsState,
  type ImageGenJobListItem
} from '@/lib/pending-image-jobs'

describe('inferImageJobBinding', () => {
  it('prefers explicit binding from API', () => {
    const j: ImageGenJobListItem = {
      id: '1',
      projectId: 'p1',
      status: 'processing',
      kind: 'character_base_regenerate',
      characterImageId: 'img-wrong',
      binding: { kind: 'character_image', characterImageId: 'img-right' }
    }
    expect(inferImageJobBinding(j)).toEqual({
      kind: 'character_image',
      characterImageId: 'img-right'
    })
  })

  it('infers character_image from characterImageId', () => {
    const j: ImageGenJobListItem = {
      id: '1',
      projectId: 'p1',
      status: 'queued',
      kind: 'character_base_regenerate',
      characterImageId: 'img-1'
    }
    expect(inferImageJobBinding(j)?.kind).toBe('character_image')
  })

  it('infers location from locationId', () => {
    const j: ImageGenJobListItem = {
      id: '1',
      projectId: 'p1',
      status: 'queued',
      kind: 'location_establishing',
      locationId: 'loc-1'
    }
    expect(inferImageJobBinding(j)).toEqual({ kind: 'location', locationId: 'loc-1' })
  })

  it('infers character_new_image from characterId + create kind', () => {
    const j: ImageGenJobListItem = {
      id: '1',
      projectId: 'p1',
      status: 'processing',
      kind: 'character_derived_create',
      characterId: 'c1'
    }
    expect(inferImageJobBinding(j)).toMatchObject({
      kind: 'character_new_image',
      characterId: 'c1',
      createKind: 'character_derived_create'
    })
  })

  it('returns undefined when nothing matches', () => {
    const j: ImageGenJobListItem = {
      id: '1',
      projectId: 'p1',
      status: 'processing',
      kind: 'unknown_kind'
    }
    expect(inferImageJobBinding(j)).toBeUndefined()
  })
})

describe('buildInFlightImageJobsState', () => {
  const pid = 'proj-1'

  it('filters by project and in-flight status only', () => {
    const list: ImageGenJobListItem[] = [
      {
        id: 'a',
        projectId: pid,
        status: 'processing',
        kind: 'location_establishing',
        locationId: 'L1',
        binding: { kind: 'location', locationId: 'L1' }
      },
      {
        id: 'b',
        projectId: 'other',
        status: 'processing',
        kind: 'location_establishing',
        locationId: 'L2',
        binding: { kind: 'location', locationId: 'L2' }
      },
      {
        id: 'c',
        projectId: pid,
        status: 'completed',
        kind: 'character_base_regenerate',
        characterImageId: 'I1',
        binding: { kind: 'character_image', characterImageId: 'I1' }
      }
    ]
    const s = buildInFlightImageJobsState(pid, list)
    expect(s.jobs).toHaveLength(1)
    expect(s.jobs[0].id).toBe('a')
    expect(s.locationIds.has('L1')).toBe(true)
    expect(s.characterImageIds.size).toBe(0)
  })

  it('maps job id per character image and location', () => {
    const list: ImageGenJobListItem[] = [
      {
        id: 'job-img',
        projectId: pid,
        status: 'queued',
        kind: 'character_derived_regenerate',
        characterImageId: 'img-x',
        binding: { kind: 'character_image', characterImageId: 'img-x' }
      },
      {
        id: 'job-loc',
        projectId: pid,
        status: 'processing',
        kind: 'location_establishing',
        locationId: 'loc-y',
        binding: { kind: 'location', locationId: 'loc-y' }
      },
      {
        id: 'job-new',
        projectId: pid,
        status: 'pending',
        kind: 'character_base_create',
        characterId: 'char-z',
        binding: {
          kind: 'character_new_image',
          characterId: 'char-z',
          createKind: 'character_base_create',
          name: '定妆'
        }
      }
    ]
    const s = buildInFlightImageJobsState(pid, list)
    expect(s.jobIdsByCharacterImageId.get('img-x')).toBe('job-img')
    expect(s.jobIdsByLocationId.get('loc-y')).toBe('job-loc')
    expect(s.characterIdsWithPendingNewImage.has('char-z')).toBe(true)
    expect(s.characterImageIds.has('img-x')).toBe(true)
    expect(s.locationIds.has('loc-y')).toBe(true)
  })
})
