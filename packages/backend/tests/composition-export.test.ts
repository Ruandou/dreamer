import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Suppress console.error/warn for cleaner test output
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

const { mockCompositionFindUnique, mockCompositionUpdate } = vi.hoisted(() => ({
  mockCompositionFindUnique: vi.fn(),
  mockCompositionUpdate: vi.fn()
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    composition: {
      findUnique: mockCompositionFindUnique,
      update: mockCompositionUpdate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

const mockComposeVideo = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    outputUrl: 'https://storage.example.com/out.mp4',
    duration: 42,
    width: 1080,
    height: 1920
  })
)

vi.mock('../src/services/ffmpeg.js', () => ({
  composeVideo: (...args: unknown[]) => mockComposeVideo(...args)
}))

import { runCompositionExport } from '../src/services/composition-export.js'

describe('runCompositionExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when composition missing', async () => {
    mockCompositionFindUnique.mockResolvedValue(null)
    const r = await runCompositionExport('missing')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.httpStatus).toBe(404)
      expect(r.error).toContain('not found')
    }
  })

  it('returns 400 when no clips', async () => {
    mockCompositionFindUnique.mockResolvedValue({
      id: 'c1',
      scenes: []
    })
    const r = await runCompositionExport('c1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.httpStatus).toBe(400)
  })

  it('returns 500 when take has no video URL', async () => {
    mockCompositionFindUnique.mockResolvedValue({
      id: 'c1',
      scenes: [{ takeId: 't1', take: { videoUrl: null } }]
    })
    const r = await runCompositionExport('c1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.httpStatus).toBe(500)
  })

  it('composes and marks completed on success', async () => {
    mockCompositionFindUnique.mockResolvedValue({
      id: 'c1',
      scenes: [
        {
          takeId: 't1',
          take: { videoUrl: 'https://cdn.example.com/a.mp4' }
        }
      ]
    })
    mockCompositionUpdate.mockResolvedValue({})

    const r = await runCompositionExport('c1')

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.outputUrl).toContain('out.mp4')
      expect(r.duration).toBe(42)
    }
    expect(mockComposeVideo).toHaveBeenCalled()
    const lastUpdate = mockCompositionUpdate.mock.calls.at(-1)?.[0] as { data: { status: string } }
    expect(lastUpdate?.data?.status).toBe('completed')
  })
})
