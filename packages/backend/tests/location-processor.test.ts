import { describe, it, expect, vi } from 'vitest'
import { processLocationImagePrompts } from '../src/services/visual-enrich/location-processor.js'
import { locationRepository } from '../src/repositories/location-repository.js'

vi.mock('../src/repositories/location-repository.js', () => ({
  locationRepository: {
    updateManyActiveImagePromptByProjectAndName: vi.fn()
  }
}))

describe('processLocationImagePrompts', () => {
  const sanitize = (text: string) => text.trim()

  it('returns 0 when payloadLocations is undefined', async () => {
    const result = await processLocationImagePrompts(
      'proj-1',
      undefined,
      ['客厅', '卧室'],
      sanitize
    )
    expect(result).toBe(0)
  })

  it('returns 0 when payloadLocations is not an array', async () => {
    const result = await processLocationImagePrompts(
      'proj-1',
      'not-array' as any,
      ['客厅', '卧室'],
      sanitize
    )
    expect(result).toBe(0)
  })

  it('returns 0 when payloadLocations is empty', async () => {
    const result = await processLocationImagePrompts('proj-1', [], ['客厅', '卧室'], sanitize)
    expect(result).toBe(0)
  })

  it('skips locations without imagePrompt', async () => {
    vi.mocked(locationRepository.updateManyActiveImagePromptByProjectAndName).mockResolvedValue({
      count: 0
    })
    const result = await processLocationImagePrompts(
      'proj-1',
      [{ name: '客厅' }],
      ['客厅', '卧室'],
      sanitize
    )
    expect(result).toBe(0)
    expect(locationRepository.updateManyActiveImagePromptByProjectAndName).not.toHaveBeenCalled()
  })

  it('skips locations with empty imagePrompt', async () => {
    vi.mocked(locationRepository.updateManyActiveImagePromptByProjectAndName).mockResolvedValue({
      count: 0
    })
    const result = await processLocationImagePrompts(
      'proj-1',
      [{ name: '客厅', imagePrompt: '   ' }],
      ['客厅', '卧室'],
      sanitize
    )
    expect(result).toBe(0)
  })

  it('skips locations that cannot be resolved', async () => {
    vi.mocked(locationRepository.updateManyActiveImagePromptByProjectAndName).mockResolvedValue({
      count: 0
    })
    const result = await processLocationImagePrompts(
      'proj-1',
      [{ name: '未知场地', imagePrompt: 'prompt' }],
      ['客厅', '卧室'],
      sanitize
    )
    expect(result).toBe(0)
    expect(locationRepository.updateManyActiveImagePromptByProjectAndName).not.toHaveBeenCalled()
  })

  it('processes valid location and returns count', async () => {
    vi.mocked(locationRepository.updateManyActiveImagePromptByProjectAndName).mockResolvedValue({
      count: 1
    })
    const result = await processLocationImagePrompts(
      'proj-1',
      [{ name: '客厅', imagePrompt: '  温馨的客厅  ' }],
      ['客厅', '卧室'],
      sanitize
    )
    expect(result).toBe(1)
    expect(locationRepository.updateManyActiveImagePromptByProjectAndName).toHaveBeenCalledWith(
      'proj-1',
      '客厅',
      '温馨的客厅'
    )
  })

  it('processes multiple locations with mixed validity', async () => {
    vi.mocked(locationRepository.updateManyActiveImagePromptByProjectAndName)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    const result = await processLocationImagePrompts(
      'proj-1',
      [
        { name: '客厅', imagePrompt: 'prompt1' },
        { name: '未知', imagePrompt: 'prompt2' },
        { name: '卧室', imagePrompt: 'prompt3' }
      ],
      ['客厅', '卧室'],
      sanitize
    )
    expect(result).toBe(1)
  })

  it('applies sanitize function to prompt', async () => {
    vi.mocked(locationRepository.updateManyActiveImagePromptByProjectAndName).mockResolvedValue({
      count: 1
    })
    const customSanitize = (text: string) => text.replace(/bad/g, 'good').trim()
    await processLocationImagePrompts(
      'proj-1',
      [{ name: '客厅', imagePrompt: 'bad prompt' }],
      ['客厅'],
      customSanitize
    )
    expect(locationRepository.updateManyActiveImagePromptByProjectAndName).toHaveBeenCalledWith(
      'proj-1',
      '客厅',
      'good prompt'
    )
  })
})
