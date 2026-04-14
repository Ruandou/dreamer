import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../src/services/storage.js', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://minio/assets/final.png'),
  generateFileKey: vi.fn().mockReturnValue('assets/ai_gen_test.png')
}))

import {
  generateImageEdit,
  generateImageEditAndPersist,
  remoteImageUrlToDataUrl
} from '../src/services/image-generation.js'

describe('image-generation edit & persist helpers', () => {
  let prevKey: string | undefined
  let prevEditB64: string | undefined

  beforeEach(() => {
    prevKey = process.env.ARK_API_KEY
    prevEditB64 = process.env.ARK_IMAGE_EDIT_USE_BASE64
    process.env.ARK_API_KEY = 'test-key'
    /** `'0'` 时用 URL 直传编辑接口，避免再拉参考图 */
    process.env.ARK_IMAGE_EDIT_USE_BASE64 = '0'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (prevKey === undefined) delete process.env.ARK_API_KEY
    else process.env.ARK_API_KEY = prevKey
    if (prevEditB64 === undefined) delete process.env.ARK_IMAGE_EDIT_USE_BASE64
    else process.env.ARK_IMAGE_EDIT_USE_BASE64 = prevEditB64
  })

  it('remoteImageUrlToDataUrl converts remote image to data url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([7, 7]).buffer,
        headers: { get: (n: string) => (n === 'content-type' ? 'image/jpeg' : null) }
      })
    )
    const dataUrl = await remoteImageUrlToDataUrl('https://cdn.example/a.jpg')
    expect(dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('generateImageEdit returns ark url without persisting wrapper', async () => {
    delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: [{ url: 'https://ark.example/generated.png' }],
            usage: { total_tokens: 10_000 }
          })
      })
    )
    const out = await generateImageEdit('https://ref.example/r.png', '加一顶帽子', { size: '1920x1920' })
    expect(out.url).toBe('https://ark.example/generated.png')
    expect(out.imageCost).toBe(0.04)
  })

  it('generateImageEditAndPersist stores via uploadFile', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo) => {
        const u = String(input)
        if (u.includes('/images/generations')) {
          return Promise.resolve({
            ok: true,
            text: async () =>
              JSON.stringify({
                data: [{ url: 'https://tmp/out.png' }],
                usage: {}
              })
          })
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          headers: { get: () => 'image/png' }
        })
      })
    )
    const out = await generateImageEditAndPersist('https://any/ref.png', 'prompt')
    expect(out.url).toBe('https://minio/assets/final.png')
  })
})
