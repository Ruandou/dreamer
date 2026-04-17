import { describe, it, expect } from 'vitest'
import { normalizeParsedCharacterList } from '../src/services/ai/parsed-script-types.js'

describe('parsed-script-types', () => {
  describe('normalizeParsedCharacterList', () => {
    it('adds base image when no images provided', () => {
      const characters = [
        {
          name: 'Alice',
          description: 'Main character'
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Alice')
      expect(result[0].images).toHaveLength(1)
      expect(result[0].images?.[0]).toEqual({
        name: '基础形象',
        type: 'base',
        description: 'Main character'
      })
    })

    it('keeps existing images and sorts base first', () => {
      const characters = [
        {
          name: 'Bob',
          description: 'Supporting character',
          images: [
            { name: 'Outfit 1', type: 'outfit', description: 'Casual wear' },
            { name: 'Base', type: 'base', description: 'Default look' }
          ]
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].images).toHaveLength(2)
      expect(result[0].images?.[0].type).toBe('base')
      expect(result[0].images?.[1].type).toBe('outfit')
    })

    it('adds base image when missing from images array', () => {
      const characters = [
        {
          name: 'Charlie',
          description: 'Villain',
          images: [{ name: 'Evil smile', type: 'expression', description: 'Menacing' }]
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].images).toHaveLength(2)
      expect(result[0].images?.[0].type).toBe('base')
      expect(result[0].images?.[0].name).toBe('基础形象')
      expect(result[0].images?.[1].type).toBe('expression')
    })

    it('handles multiple characters', () => {
      const characters = [
        {
          name: 'Alice',
          description: 'Hero',
          images: [{ name: 'Hero look', type: 'base', description: 'Heroic' }]
        },
        {
          name: 'Bob',
          description: 'Sidekick'
        },
        {
          name: 'Charlie',
          description: 'Villain',
          images: [
            { name: 'Evil', type: 'expression', description: 'Menacing' },
            { name: 'Dark', type: 'base', description: 'Dark look' }
          ]
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result).toHaveLength(3)
      expect(result[0].images?.[0].type).toBe('base')
      expect(result[1].images?.[0].type).toBe('base')
      expect(result[2].images?.[0].type).toBe('base')
      expect(result[2].images?.[1].type).toBe('expression')
    })

    it('trims whitespace from image fields', () => {
      const characters = [
        {
          name: 'Test',
          description: '  Trimmed  ',
          images: [{ name: '  Image Name  ', type: 'outfit', description: '  Desc  ' }]
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      // Should add base image first, then the outfit
      expect(result[0].images).toHaveLength(2)
      expect(result[0].images?.[0].name).toBe('基础形象')
      expect(result[0].images?.[0].type).toBe('base')
      expect(result[0].images?.[1].name).toBe('Image Name')
      expect(result[0].images?.[1].type).toBe('outfit')
      expect(result[0].images?.[1].description).toBe('Desc')
      expect(result[0].description).toBe('  Trimmed  ')
    })

    it('defaults empty image name to 基础形象', () => {
      const characters = [
        {
          name: 'Test',
          description: 'Test char',
          images: [{ name: '', type: 'base', description: 'No name' }]
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].images?.[0].name).toBe('基础形象')
    })

    it('handles empty images array', () => {
      const characters = [
        {
          name: 'Empty',
          description: 'No images',
          images: []
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].images).toHaveLength(1)
      expect(result[0].images?.[0].type).toBe('base')
      expect(result[0].images?.[0].name).toBe('基础形象')
    })

    it('preserves aliases array', () => {
      const characters = [
        {
          name: 'John',
          description: 'Has aliases',
          aliases: ['Johnny', 'J.D.', 'The Boss']
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].aliases).toEqual(['Johnny', 'J.D.', 'The Boss'])
    })

    it('trims and filters aliases', () => {
      const characters = [
        {
          name: 'Jane',
          description: 'Trimmed aliases',
          aliases: ['  Janie  ', '', '  ', 'JJ', '   ']
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].aliases).toEqual(['Janie', 'JJ'])
    })

    it('handles missing aliases field', () => {
      const characters = [
        {
          name: 'NoAliases',
          description: 'No aliases'
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].aliases).toBeUndefined()
    })

    it('handles non-array aliases', () => {
      const characters = [
        {
          name: 'BadAliases',
          description: 'Invalid aliases',
          aliases: 'not an array' as any
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].aliases).toBeUndefined()
    })

    it('handles non-array images', () => {
      const characters = [
        {
          name: 'BadImages',
          description: 'Invalid images',
          images: 'not an array' as any
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].images).toHaveLength(1)
      expect(result[0].images?.[0].type).toBe('base')
    })

    it('sorts multiple image types correctly', () => {
      const characters = [
        {
          name: 'Multi',
          description: 'Multiple types',
          images: [
            { name: 'Pose 1', type: 'pose', description: 'Standing' },
            { name: 'Outfit 1', type: 'outfit', description: 'Suit' },
            { name: 'Expression 1', type: 'expression', description: 'Happy' },
            { name: 'Base Look', type: 'base', description: 'Default' }
          ]
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].images).toHaveLength(4)
      expect(result[0].images?.[0].type).toBe('base')
      // Non-base types should come after (order among them doesn't matter)
      const nonBaseTypes = result[0].images?.slice(1).map((i) => i.type)
      expect(nonBaseTypes).toContain('pose')
      expect(nonBaseTypes).toContain('outfit')
      expect(nonBaseTypes).toContain('expression')
    })

    it('handles empty character list', () => {
      const result = normalizeParsedCharacterList([])

      expect(result).toEqual([])
    })

    it('handles undefined description', () => {
      const characters = [
        {
          name: 'NoDesc',
          description: undefined as any
        }
      ]

      const result = normalizeParsedCharacterList(characters)

      expect(result[0].description).toBe('')
      expect(result[0].images?.[0].description).toBe('')
    })
  })
})
