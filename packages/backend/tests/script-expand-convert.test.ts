import { describe, it, expect } from 'vitest'
import { convertDeepSeekResponse } from '../src/services/ai/script-expand.js'

describe('script-expand', () => {
  describe('convertDeepSeekResponse', () => {
    it('converts basic script structure', () => {
      const response = {
        title: 'My Story',
        summary: 'A great story about love',
        scenes: [
          {
            sceneNum: 1,
            location: 'Coffee Shop',
            timeOfDay: 'morning',
            characters: ['Alice', 'Bob'],
            description: 'Alice meets Bob',
            dialogues: [
              { character: 'Alice', content: 'Hi Bob!' },
              { character: 'Bob', content: 'Hello Alice!' }
            ],
            actions: ['sits down', 'drinks coffee']
          }
        ]
      }

      const result = convertDeepSeekResponse(response)

      expect(result.title).toBe('My Story')
      expect(result.summary).toBe('A great story about love')
      expect(result.scenes).toHaveLength(1)
      expect(result.scenes[0].sceneNum).toBe(1)
      expect(result.scenes[0].location).toBe('Coffee Shop')
      expect(result.scenes[0].timeOfDay).toBe('morning')
      expect(result.scenes[0].characters).toEqual(['Alice', 'Bob'])
      expect(result.scenes[0].description).toBe('Alice meets Bob')
      expect(result.scenes[0].dialogues).toHaveLength(2)
      expect(result.scenes[0].actions).toEqual(['sits down', 'drinks coffee'])
    })

    it('handles missing optional fields', () => {
      const response = {
        title: 'Simple',
        scenes: [
          {
            sceneNum: 1,
            description: 'Just description'
          }
        ]
      }

      const result = convertDeepSeekResponse(response)

      expect(result.title).toBe('Simple')
      expect(result.scenes[0].description).toBe('Just description')
      expect(result.scenes[0].location).toBe('')
      expect(result.scenes[0].timeOfDay).toBe('日') // Defaults to '日'
    })

    it('handles multiple scenes', () => {
      const response = {
        title: 'Multi Scene',
        summary: 'Story with multiple scenes',
        scenes: [
          {
            sceneNum: 1,
            location: 'Home',
            timeOfDay: 'morning',
            characters: ['Alice'],
            description: 'Alice wakes up',
            dialogues: [],
            actions: ['wakes up']
          },
          {
            sceneNum: 2,
            location: 'Office',
            timeOfDay: 'afternoon',
            characters: ['Alice', 'Boss'],
            description: 'Alice at work',
            dialogues: [{ character: 'Boss', content: 'Work harder!' }],
            actions: ['types', 'meets boss']
          },
          {
            sceneNum: 3,
            location: 'Park',
            timeOfDay: 'evening',
            characters: ['Alice'],
            description: 'Alice relaxes',
            dialogues: [],
            actions: ['walks']
          }
        ]
      }

      const result = convertDeepSeekResponse(response)

      expect(result.scenes).toHaveLength(3)
      expect(result.scenes[0].sceneNum).toBe(1)
      expect(result.scenes[1].sceneNum).toBe(2)
      expect(result.scenes[2].sceneNum).toBe(3)
    })

    it('handles empty scenes array', () => {
      const response = {
        title: 'No Scenes',
        summary: 'Empty',
        scenes: []
      }

      const result = convertDeepSeekResponse(response)

      expect(result.scenes).toHaveLength(0)
    })

    it('preserves dialogue order', () => {
      const response = {
        title: 'Dialogue Test',
        scenes: [
          {
            sceneNum: 1,
            description: 'Conversation',
            dialogues: [
              { character: 'A', content: 'First' },
              { character: 'B', content: 'Second' },
              { character: 'A', content: 'Third' },
              { character: 'B', content: 'Fourth' }
            ]
          }
        ]
      }

      const result = convertDeepSeekResponse(response)

      expect(result.scenes[0].dialogues).toHaveLength(4)
      expect(result.scenes[0].dialogues[0].character).toBe('A')
      expect(result.scenes[0].dialogues[0].content).toBe('First')
      expect(result.scenes[0].dialogues[2].character).toBe('A')
      expect(result.scenes[0].dialogues[2].content).toBe('Third')
    })

    it('handles special characters in content', () => {
      const response = {
        title: 'Special <>&"\' Characters',
        summary: 'Test with <script> tags & "quotes"',
        scenes: [
          {
            sceneNum: 1,
            location: 'Room with & symbols',
            description: 'Test',
            dialogues: [
              { character: 'Alice', content: 'Hello & goodbye!' },
              { character: 'Bob', content: '<em>Emphasized</em>' }
            ],
            actions: ['runs & jumps', 'stops']
          }
        ]
      }

      const result = convertDeepSeekResponse(response)

      expect(result.title).toBe('Special <>&"\' Characters')
      expect(result.summary).toBe('Test with <script> tags & "quotes"')
      expect(result.scenes[0].dialogues[0].content).toBe('Hello & goodbye!')
      expect(result.scenes[0].dialogues[1].content).toBe('<em>Emphasized</em>')
    })

    it('handles undefined dialogues', () => {
      const response = {
        title: 'No Dialogues',
        scenes: [
          {
            sceneNum: 1,
            description: 'Silent scene'
          }
        ]
      }

      const result = convertDeepSeekResponse(response)

      expect(result.scenes[0].dialogues).toEqual([])
    })

    it('handles undefined actions', () => {
      const response = {
        title: 'No Actions',
        scenes: [
          {
            sceneNum: 1,
            description: 'No actions'
          }
        ]
      }

      const result = convertDeepSeekResponse(response)

      expect(result.scenes[0].actions).toEqual([])
    })

    it('handles long script content', () => {
      const scenes = Array.from({ length: 50 }, (_, i) => ({
        sceneNum: i + 1,
        location: `Location ${i}`,
        timeOfDay: 'day',
        characters: [`Character ${i}`],
        description: `Scene ${i} description`,
        dialogues: [{ character: `Character ${i}`, content: `Dialogue ${i}` }],
        actions: [`Action ${i}`]
      }))

      const response = {
        title: 'Long Script',
        summary: 'A very long script',
        scenes
      }

      const result = convertDeepSeekResponse(response)

      expect(result.scenes).toHaveLength(50)
      expect(result.scenes[0].sceneNum).toBe(1)
      expect(result.scenes[49].sceneNum).toBe(50)
    })

    it('handles nested objects in response', () => {
      const response = {
        title: 'Nested Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            description: 'Scene',
            dialogues: [
              {
                character: 'Alice',
                content: 'Hello',
                extra: 'ignored field'
              }
            ],
            actions: ['action1', 'action2']
          }
        ],
        extra: 'should be ignored'
      }

      const result = convertDeepSeekResponse(response)

      expect(result.title).toBe('Nested Test')
      expect(result.scenes[0].dialogues[0].character).toBe('Alice')
      expect(result.scenes[0].dialogues[0].content).toBe('Hello')
      // Extra fields should not be in the result
      expect((result as any).extra).toBeUndefined()
    })
  })
})
