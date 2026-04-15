import { describe, it, expect } from 'vitest'
import { buildSeedancePayloadFromScene } from '../src/services/seedance-scene-request.js'

describe('buildSeedancePayloadFromScene', () => {
  it('builds image order location first then characters and replaces names with 图片n', () => {
    const scene = {
      id: 's1',
      duration: 10000,
      description: 'desc',
      aspectRatio: '9:16',
      visualStyle: ['写实'],
      location: {
        id: 'l1',
        imageUrl: 'https://loc/1.jpg'
      },
      episode: {
        project: { visualStyle: ['电影感'], aspectRatio: '9:16' as const }
      },
      shots: [
        {
          shotNum: 1,
          order: 1,
          description: '张三走进房间',
          cameraAngle: null,
          cameraMovement: null,
          duration: 5000,
          characterShots: [
            {
              characterImage: {
                characterId: 'c1',
                avatarUrl: 'https://char/1.jpg',
                character: { id: 'c1', name: '张三' }
              }
            }
          ]
        },
        {
          shotNum: 2,
          order: 2,
          description: '李四看着张三',
          cameraAngle: null,
          cameraMovement: null,
          duration: 5000,
          characterShots: [
            {
              characterImage: {
                characterId: 'c2',
                avatarUrl: 'https://char/2.jpg',
                character: { id: 'c2', name: '李四' }
              }
            },
            {
              characterImage: {
                characterId: 'c1',
                avatarUrl: 'https://char/1.jpg',
                character: { id: 'c1', name: '张三' }
              }
            }
          ]
        }
      ],
      dialogues: [
        {
          characterId: 'c1',
          startTimeMs: 0,
          durationMs: 2000,
          text: '你好',
          voiceConfig: { age: 'young', gender: 'male', timbre: 'warm_solid' },
          character: { id: 'c1', name: '张三' }
        }
      ]
    }

    const r = buildSeedancePayloadFromScene(scene as any)
    expect(r).not.toBeNull()
    expect(r!.imageUrls).toEqual(['https://loc/1.jpg', 'https://char/1.jpg', 'https://char/2.jpg'])
    expect(r!.prompt).toContain('图片2')
    expect(r!.prompt).toContain('图片3')
    expect(r!.prompt).not.toContain('张三')
    expect(r!.durationSeconds).toBeGreaterThanOrEqual(4)
  })
})
