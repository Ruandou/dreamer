import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processCharacterImageSlots } from '../src/services/visual-enrich/character-processor.js'
import { characterRepository } from '../src/repositories/character-repository.js'

vi.mock('../src/repositories/character-repository.js', () => ({
  characterRepository: {
    updateCharacterImage: vi.fn(),
    createCharacterImage: vi.fn(),
    maxSiblingOrder: vi.fn()
  }
}))

describe('processCharacterImageSlots', () => {
  const makeDbCharacter = (overrides: any = {}) => ({
    id: 'char-1',
    name: 'Alice',
    images: [],
    ...overrides
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns early when payloadCharacters is undefined', async () => {
    await processCharacterImageSlots('proj-1', undefined, [makeDbCharacter()])
    expect(characterRepository.updateCharacterImage).not.toHaveBeenCalled()
    expect(characterRepository.createCharacterImage).not.toHaveBeenCalled()
  })

  it('returns early when payloadCharacters is not an array', async () => {
    await processCharacterImageSlots('proj-1', 'not-array' as any, [makeDbCharacter()])
    expect(characterRepository.updateCharacterImage).not.toHaveBeenCalled()
  })

  it('skips payload characters without name', async () => {
    await processCharacterImageSlots('proj-1', [{ name: '' }], [makeDbCharacter()])
    expect(characterRepository.updateCharacterImage).not.toHaveBeenCalled()
  })

  it('skips when character not found in db', async () => {
    await processCharacterImageSlots('proj-1', [{ name: 'Bob' }], [makeDbCharacter()])
    expect(characterRepository.updateCharacterImage).not.toHaveBeenCalled()
  })

  it('skips slots without name or prompt', async () => {
    await processCharacterImageSlots(
      'proj-1',
      [{ name: 'Alice', images: [{ name: '', prompt: '' }] }],
      [makeDbCharacter()]
    )
    expect(characterRepository.updateCharacterImage).not.toHaveBeenCalled()
  })

  it('creates new base image when no existing base', async () => {
    vi.mocked(characterRepository.createCharacterImage).mockResolvedValue({
      id: 'img-1',
      characterId: 'char-1',
      name: '基础形象',
      type: 'base',
      prompt: 'prompt',
      description: null,
      avatarUrl: null,
      order: 0,
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    } as any)

    await processCharacterImageSlots(
      'proj-1',
      [{ name: 'Alice', images: [{ name: '基础形象', type: 'base', prompt: 'prompt' }] }],
      [makeDbCharacter()]
    )

    expect(characterRepository.createCharacterImage).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: 'char-1',
        name: '基础形象',
        type: 'base',
        prompt: 'prompt'
      })
    )
  })

  it('updates existing base image', async () => {
    vi.mocked(characterRepository.updateCharacterImage).mockResolvedValue({} as any)

    const dbChar = makeDbCharacter({
      images: [
        {
          id: 'base-1',
          type: 'base',
          parentId: null,
          prompt: 'old prompt',
          description: 'old desc',
          name: '旧形象'
        }
      ]
    })

    await processCharacterImageSlots(
      'proj-1',
      [
        {
          name: 'Alice',
          images: [{ name: '新形象', type: 'base', prompt: 'new prompt', description: 'new desc' }]
        }
      ],
      [dbChar]
    )

    expect(characterRepository.updateCharacterImage).toHaveBeenCalledWith(
      'base-1',
      expect.objectContaining({
        prompt: 'new prompt',
        name: '新形象'
      })
    )
  })

  it('creates derived image with outfit type', async () => {
    vi.mocked(characterRepository.maxSiblingOrder).mockResolvedValue({
      _max: { order: null }
    } as any)
    vi.mocked(characterRepository.createCharacterImage).mockResolvedValue({
      id: 'img-2',
      characterId: 'char-1',
      name: '换装',
      type: 'outfit',
      prompt: 'derived',
      description: null,
      avatarUrl: null,
      order: 1,
      parentId: 'base-1',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any)

    const dbChar = makeDbCharacter({
      images: [
        {
          id: 'base-1',
          type: 'base',
          parentId: null,
          prompt: 'base prompt',
          description: null,
          name: '基础'
        }
      ]
    })

    await processCharacterImageSlots(
      'proj-1',
      [{ name: 'Alice', images: [{ name: '换装', type: 'outfit', prompt: 'new clothes' }] }],
      [dbChar]
    )

    expect(characterRepository.createCharacterImage).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: 'char-1',
        name: '换装',
        type: 'outfit',
        parentId: 'base-1'
      })
    )
  })

  it('skips derived image when no parent base exists', async () => {
    await processCharacterImageSlots(
      'proj-1',
      [{ name: 'Alice', images: [{ name: '换装', type: 'outfit', prompt: 'new clothes' }] }],
      [makeDbCharacter()]
    )

    expect(characterRepository.createCharacterImage).not.toHaveBeenCalled()
  })

  it('skips unknown image types', async () => {
    await processCharacterImageSlots(
      'proj-1',
      [{ name: 'Alice', images: [{ name: '未知', type: 'unknown', prompt: 'prompt' }] }],
      [makeDbCharacter()]
    )

    expect(characterRepository.createCharacterImage).not.toHaveBeenCalled()
    expect(characterRepository.updateCharacterImage).not.toHaveBeenCalled()
  })

  it('sorts images with base first', async () => {
    vi.mocked(characterRepository.createCharacterImage).mockResolvedValue({
      id: 'img-1',
      characterId: 'char-1',
      name: '基础',
      type: 'base',
      prompt: 'base prompt',
      description: null,
      avatarUrl: null,
      order: 0,
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    } as any)

    await processCharacterImageSlots(
      'proj-1',
      [
        {
          name: 'Alice',
          images: [
            { name: '表情1', type: 'expression', prompt: 'expr' },
            { name: '基础', type: 'base', prompt: 'base prompt' }
          ]
        }
      ],
      [makeDbCharacter()]
    )

    // Base should be processed first (createCharacterImage called for base)
    expect(characterRepository.createCharacterImage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'base' })
    )
  })
})
