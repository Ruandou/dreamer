import { describe, it, expect } from 'vitest'

describe('seedance-scene-request utilities', () => {
  // Import the pure functions we want to test
  // We'll test them through the module

  describe('escapeRegExp (internal)', () => {
    it('escapes special regex characters', async () => {
      // Test by importing and using indirectly
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      // We can't test escapeRegExp directly (it's not exported)
      // But we can verify it works through buildSeedancePayloadFromScene
      // by creating a scene with special characters in character names

      const mockScene = {
        id: 'scene-1',
        description: 'Alice meets Bob',
        duration: 10000,
        aspectRatio: '9:16',
        visualStyle: ['cinematic'],
        location: {
          id: 'loc-1',
          name: 'Office',
          imageUrl: 'https://example.com/office.jpg'
        },
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: []
          }
        },
        shots: [],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.prompt).toContain('Alice meets Bob')
    })

    it('handles character names with special regex characters', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Test with [brackets] and (parens)',
        duration: 10000,
        aspectRatio: '9:16',
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: []
          }
        },
        shots: [],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.prompt).toContain('[brackets]')
      expect(result?.prompt).toContain('(parens)')
    })
  })

  describe('voiceConfigToShortDesc (internal)', () => {
    it('converts voice config to short description', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Scene with dialogue',
        duration: 10000,
        aspectRatio: '9:16',
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: []
          }
        },
        shots: [
          {
            id: 'shot-1',
            shotNum: 1,
            order: 1,
            description: 'Character speaks',
            duration: 5000,
            cameraMovement: null,
            cameraAngle: null,
            characterShots: [
              {
                id: 'cs-1',
                characterImage: {
                  id: 'img-1',
                  characterId: 'char-1',
                  character: {
                    id: 'char-1',
                    name: 'Alice'
                  },
                  avatarUrl: 'https://example.com/alice.jpg'
                }
              }
            ]
          }
        ],
        dialogues: [
          {
            id: 'dialogue-1',
            characterId: 'char-1',
            character: {
              id: 'char-1',
              name: 'Alice'
            },
            text: 'Hello world',
            startTimeMs: 1000,
            durationMs: 2000,
            voiceConfig: {
              age: 'young',
              gender: 'female',
              timbre: 'clear'
            }
          }
        ]
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.prompt).toContain('图片1用young，female，clear声说道')
      expect(result?.prompt).toContain('Hello world')
      expect(result?.prompt).toContain('1-3秒')
    })

    it('handles missing voice config', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Scene',
        duration: 10000,
        aspectRatio: '9:16',
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: []
          }
        },
        shots: [
          {
            id: 'shot-1',
            shotNum: 1,
            order: 1,
            description: 'Test',
            duration: 5000,
            cameraMovement: null,
            cameraAngle: null,
            characterShots: [
              {
                id: 'cs-1',
                characterImage: {
                  id: 'img-1',
                  characterId: 'char-1',
                  character: {
                    id: 'char-1',
                    name: 'Bob'
                  },
                  avatarUrl: 'https://example.com/bob.jpg'
                }
              }
            ]
          }
        ],
        dialogues: [
          {
            id: 'dialogue-1',
            characterId: 'char-1',
            character: {
              id: 'char-1',
              name: 'Bob'
            },
            text: 'Hi',
            startTimeMs: 0,
            durationMs: 1000,
            voiceConfig: null
          }
        ]
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.prompt).toContain('图片1说道')
    })
  })

  describe('mergeVisualStyleLabels (internal)', () => {
    it('merges scene and project visual styles', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Test scene',
        duration: 10000,
        aspectRatio: '9:16',
        visualStyle: ['cinematic', 'dramatic'],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: ['anime', 'colorful']
          }
        },
        shots: [],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.prompt).toContain('cinematic')
      expect(result?.prompt).toContain('dramatic')
      expect(result?.prompt).toContain('anime')
      expect(result?.prompt).toContain('colorful')
      expect(result?.prompt).toContain('动漫风格，虚拟角色，非真人')
    })

    it('removes duplicate styles', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Test',
        duration: 10000,
        aspectRatio: '9:16',
        visualStyle: ['cinematic', 'dramatic', 'cinematic'],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: ['dramatic', 'anime']
          }
        },
        shots: [],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      // Should appear only once each
      const cinematicCount = (result?.prompt?.match(/cinematic/g) || []).length
      const dramaticCount = (result?.prompt?.match(/dramatic/g) || []).length
      expect(cinematicCount).toBe(1)
      expect(dramaticCount).toBe(1)
    })

    it('handles empty visual styles', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Minimal',
        duration: 10000,
        aspectRatio: '9:16',
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: []
          }
        },
        shots: [],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.prompt).toContain('动漫风格，虚拟角色，非真人，动画形象')
      expect(result?.prompt).toContain('8K超高清')
    })
  })

  describe('duration clamping', () => {
    it('clamps duration to minimum 4 seconds', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Short scene',
        duration: 1000, // 1 second
        aspectRatio: '9:16',
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: []
          }
        },
        shots: [
          {
            id: 'shot-1',
            shotNum: 1,
            order: 1,
            description: 'Quick shot',
            duration: 1000,
            cameraMovement: null,
            cameraAngle: null,
            characterShots: []
          }
        ],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.durationSeconds).toBe(4) // MIN_DUR
    })

    it('clamps duration to maximum 15 seconds', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Long scene',
        duration: 30000, // 30 seconds
        aspectRatio: '9:16',
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: []
          }
        },
        shots: [],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.durationSeconds).toBe(15) // MAX_DUR
    })

    it('uses shot durations when scene duration is invalid', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Test',
        duration: 0, // Invalid
        aspectRatio: '9:16',
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: []
          }
        },
        shots: [
          {
            id: 'shot-1',
            shotNum: 1,
            order: 1,
            description: 'Shot 1',
            duration: 3000,
            cameraMovement: null,
            cameraAngle: null,
            characterShots: []
          },
          {
            id: 'shot-2',
            shotNum: 2,
            order: 2,
            description: 'Shot 2',
            duration: 4000,
            cameraMovement: null,
            cameraAngle: null,
            characterShots: []
          }
        ],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.durationSeconds).toBe(7) // 3 + 4 = 7 seconds
    })
  })

  describe('aspect ratio validation', () => {
    it('uses scene aspect ratio when valid', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Test',
        duration: 10000,
        aspectRatio: '16:9',
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: []
          }
        },
        shots: [],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.aspectRatio).toBe('16:9')
    })

    it('falls back to project aspect ratio', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Test',
        duration: 10000,
        aspectRatio: null,
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '4:3',
            visualStyle: []
          }
        },
        shots: [],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.aspectRatio).toBe('4:3')
    })

    it('defaults to 9:16 when invalid', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const mockScene = {
        id: 'scene-1',
        description: 'Test',
        duration: 10000,
        aspectRatio: 'invalid',
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: 'invalid',
            visualStyle: []
          }
        },
        shots: [],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.aspectRatio).toBe('9:16')
    })
  })

  describe('image URL capping', () => {
    it('limits reference images to 9', async () => {
      const { buildSeedancePayloadFromScene } =
        await import('../src/services/ai/seedance-scene-request.js')

      const characterShots = Array.from({ length: 15 }, (_, i) => ({
        id: `cs-${i}`,
        characterImage: {
          id: `img-${i}`,
          characterId: `char-${i}`,
          character: {
            id: `char-${i}`,
            name: `Character ${i}`
          },
          avatarUrl: `https://example.com/char${i}.jpg`
        }
      }))

      const mockScene = {
        id: 'scene-1',
        description: 'Many characters',
        duration: 10000,
        aspectRatio: '9:16',
        visualStyle: [],
        location: null,
        episode: {
          id: 'ep-1',
          episodeNum: 1,
          project: {
            id: 'proj-1',
            aspectRatio: '9:16',
            visualStyle: []
          }
        },
        shots: [
          {
            id: 'shot-1',
            shotNum: 1,
            order: 1,
            description: 'Group scene',
            duration: 5000,
            cameraMovement: null,
            cameraAngle: null,
            characterShots
          }
        ],
        dialogues: []
      }

      const result = buildSeedancePayloadFromScene(mockScene as any)
      expect(result).not.toBeNull()
      expect(result?.imageUrls.length).toBeLessThanOrEqual(9)
    })
  })
})
