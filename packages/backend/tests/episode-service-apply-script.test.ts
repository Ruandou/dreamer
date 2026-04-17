import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EpisodeService } from '../src/services/episode-service.js'
import type { ScriptContent } from '@dreamer/shared/types'

// Create mock repository
function createMockRepo() {
  return {
    findProjectForExpandScript: vi.fn(),
    update: vi.fn(),
    deleteScenesByEpisode: vi.fn(),
    findLocationByProjectAndName: vi.fn(),
    createScene: vi.fn(),
    createShot: vi.fn(),
    findUniqueWithScenes: vi.fn(),
    findScenesByEpisode: vi.fn(),
    updateScene: vi.fn(),
    deleteShot: vi.fn(),
    countScenesByEpisode: vi.fn(),
    findEpisodeWithProject: vi.fn(),
    generateEpisodeScript: vi.fn(),
    expandEpisodeScript: vi.fn()
  }
}

describe('EpisodeService.applyScriptContentToEpisode', () => {
  let mockRepo: ReturnType<typeof createMockRepo>
  let service: EpisodeService

  beforeEach(() => {
    mockRepo = createMockRepo()
    service = new EpisodeService(mockRepo as any)
    vi.clearAllMocks()
  })

  // Helper to access private method for testing
  async function callApplyScriptContentToEpisode(
    episodeId: string,
    projectId: string,
    episodeTitle: string | null | undefined,
    script: ScriptContent
  ) {
    return (service as any).applyScriptContentToEpisode(episodeId, projectId, episodeTitle, script)
  }

  it('updates episode title and script', async () => {
    mockRepo.findProjectForExpandScript.mockResolvedValue(null)
    mockRepo.update.mockResolvedValue({ id: 'ep-1', title: 'New Title' })

    const script: ScriptContent = {
      title: 'Episode Script',
      summary: 'Summary',
      scenes: []
    }

    const result = await callApplyScriptContentToEpisode(
      'ep-1',
      'proj-1',
      'Old Title',
      script
    )

    expect(mockRepo.update).toHaveBeenCalledWith('ep-1', {
      title: 'Episode Script',
      script: script
    })
    expect(result.updatedEpisode.id).toBe('ep-1')
    expect(result.scenesCreated).toBe(0)
  })

  it('uses episodeTitle as fallback when script has no title', async () => {
    mockRepo.findProjectForExpandScript.mockResolvedValue(null)
    mockRepo.update.mockResolvedValue({ id: 'ep-1' })

    const script: ScriptContent = {
      title: '',
      summary: 'Summary',
      scenes: []
    }

    await callApplyScriptContentToEpisode('ep-1', 'proj-1', 'Fallback Title', script)

    expect(mockRepo.update).toHaveBeenCalledWith('ep-1', {
      title: 'Fallback Title',
      script: script
    })
  })

  it('creates scenes from script', async () => {
    mockRepo.findProjectForExpandScript.mockResolvedValue({
      id: 'proj-1',
      aspectRatio: '9:16',
      visualStyle: ['cinematic']
    })
    mockRepo.update.mockResolvedValue({ id: 'ep-1' })
    mockRepo.deleteScenesByEpisode.mockResolvedValue(undefined)
    mockRepo.findLocationByProjectAndName.mockResolvedValue(null)
    mockRepo.createScene.mockResolvedValue({ id: 'scene-1' })

    const script: ScriptContent = {
      title: 'Test',
      summary: 'Test',
      scenes: [
        {
          sceneNum: 1,
          location: 'Office',
          timeOfDay: 'morning',
          characters: ['Alice'],
          description: 'Scene 1',
          dialogues: [],
          actions: []
        },
        {
          sceneNum: 2,
          location: 'Cafe',
          timeOfDay: 'afternoon',
          characters: ['Bob'],
          description: 'Scene 2',
          dialogues: [],
          actions: []
        }
      ]
    }

    const result = await service.applyScriptContentToEpisode('ep-1', 'proj-1', 'Title', script)

    expect(mockRepo.deleteScenesByEpisode).toHaveBeenCalledWith('ep-1')
    expect(mockRepo.createScene).toHaveBeenCalledTimes(2)
    expect(result.scenesCreated).toBe(2)
  })

  it('links scenes to existing locations', async () => {
    mockRepo.findProjectForExpandScript.mockResolvedValue(null)
    mockRepo.update.mockResolvedValue({ id: 'ep-1' })
    mockRepo.deleteScenesByEpisode.mockResolvedValue(undefined)
    mockRepo.findLocationByProjectAndName.mockResolvedValue({ id: 'loc-office' })
    mockRepo.createScene.mockResolvedValue({ id: 'scene-1' })

    const script: ScriptContent = {
      title: 'Test',
      summary: 'Test',
      scenes: [
        {
          sceneNum: 1,
          location: 'Office',
          timeOfDay: 'day',
          characters: ['Alice'],
          description: 'Scene',
          dialogues: [],
          actions: []
        }
      ]
    }

    await callApplyScriptContentToEpisode('ep-1', 'proj-1', 'Title', script)

    expect(mockRepo.findLocationByProjectAndName).toHaveBeenCalledWith('proj-1', 'Office')
    expect(mockRepo.createScene).toHaveBeenCalledWith(
      expect.objectContaining({
        locationId: 'loc-office'
      })
    )
  })

  it('calculates scene duration from shots', async () => {
    mockRepo.findProjectForExpandScript.mockResolvedValue(null)
    mockRepo.update.mockResolvedValue({ id: 'ep-1' })
    mockRepo.deleteScenesByEpisode.mockResolvedValue(undefined)
    mockRepo.findLocationByProjectAndName.mockResolvedValue(null)
    mockRepo.createScene.mockResolvedValue({ id: 'scene-1' })
    mockRepo.createShot.mockResolvedValue({ id: 'shot-1' })

    const script: ScriptContent = {
      title: 'Test',
      summary: 'Test',
      scenes: [
        {
          sceneNum: 1,
          location: 'Office',
          timeOfDay: 'day',
          characters: ['Alice'],
          description: 'Scene',
          dialogues: [],
          actions: [],
          shots: [
            {
              shotNum: 1,
              order: 1,
              description: 'Shot 1',
              duration: 5000,
              characters: []
            },
            {
              shotNum: 2,
              order: 2,
              description: 'Shot 2',
              duration: 3000,
              characters: []
            }
          ]
        }
      ]
    }

    await callApplyScriptContentToEpisode('ep-1', 'proj-1', 'Title', script)

    expect(mockRepo.createScene).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 8000 // 5000 + 3000
      })
    )
  })

  it('clamps scene duration to 15 seconds maximum', async () => {
    mockRepo.findProjectForExpandScript.mockResolvedValue(null)
    mockRepo.update.mockResolvedValue({ id: 'ep-1' })
    mockRepo.deleteScenesByEpisode.mockResolvedValue(undefined)
    mockRepo.findLocationByProjectAndName.mockResolvedValue(null)
    mockRepo.createScene.mockResolvedValue({ id: 'scene-1' })
    mockRepo.createShot.mockResolvedValue({ id: 'shot-1' })

    const script: ScriptContent = {
      title: 'Test',
      summary: 'Test',
      scenes: [
        {
          sceneNum: 1,
          location: 'Office',
          timeOfDay: 'day',
          characters: ['Alice'],
          description: 'Long scene',
          dialogues: [],
          actions: [],
          shots: [
            {
              shotNum: 1,
              order: 1,
              description: 'Long shot',
              duration: 20000, // 20 seconds
              characters: []
            }
          ]
        }
      ]
    }

    await callApplyScriptContentToEpisode('ep-1', 'proj-1', 'Title', script)

    expect(mockRepo.createScene).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 15000 // Clamped to 15 seconds
      })
    )
  })

  it('uses default duration when no shots', async () => {
    mockRepo.findProjectForExpandScript.mockResolvedValue(null)
    mockRepo.update.mockResolvedValue({ id: 'ep-1' })
    mockRepo.deleteScenesByEpisode.mockResolvedValue(undefined)
    mockRepo.findLocationByProjectAndName.mockResolvedValue(null)
    mockRepo.createScene.mockResolvedValue({ id: 'scene-1' })

    const script: ScriptContent = {
      title: 'Test',
      summary: 'Test',
      scenes: [
        {
          sceneNum: 1,
          location: 'Office',
          timeOfDay: 'day',
          characters: ['Alice'],
          description: 'Scene without shots',
          dialogues: [],
          actions: []
        }
      ]
    }

    await callApplyScriptContentToEpisode('ep-1', 'proj-1', 'Title', script)

    expect(mockRepo.createScene).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 5000 // Default
      })
    )
  })

  it('creates shots when scene has shots array', async () => {
    mockRepo.findProjectForExpandScript.mockResolvedValue(null)
    mockRepo.update.mockResolvedValue({ id: 'ep-1' })
    mockRepo.deleteScenesByEpisode.mockResolvedValue(undefined)
    mockRepo.findLocationByProjectAndName.mockResolvedValue(null)
    mockRepo.createScene.mockResolvedValue({ id: 'scene-1' })
    mockRepo.createShot.mockResolvedValue({ id: 'shot-1' })

    const script: ScriptContent = {
      title: 'Test',
      summary: 'Test',
      scenes: [
        {
          sceneNum: 1,
          location: 'Office',
          timeOfDay: 'day',
          characters: ['Alice'],
          description: 'Scene',
          dialogues: [],
          actions: [],
          shots: [
            {
              shotNum: 1,
              order: 1,
              description: 'Wide shot',
              cameraAngle: 'wide',
              cameraMovement: 'static',
              duration: 5000,
              characters: []
            },
            {
              shotNum: 2,
              order: 2,
              description: 'Close up',
              cameraAngle: 'close',
              cameraMovement: 'pan',
              duration: 3000,
              characters: []
            }
          ]
        }
      ]
    }

    await callApplyScriptContentToEpisode('ep-1', 'proj-1', 'Title', script)

    expect(mockRepo.createShot).toHaveBeenCalledTimes(2)
    expect(mockRepo.createShot).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sceneId: 'scene-1',
        shotNum: 1,
        cameraAngle: 'wide'
      })
    )
  })

  it('applies project visual style to scenes', async () => {
    mockRepo.findProjectForExpandScript.mockResolvedValue({
      id: 'proj-1',
      aspectRatio: '16:9',
      visualStyle: ['cinematic', 'dramatic']
    })
    mockRepo.update.mockResolvedValue({ id: 'ep-1' })
    mockRepo.deleteScenesByEpisode.mockResolvedValue(undefined)
    mockRepo.findLocationByProjectAndName.mockResolvedValue(null)
    mockRepo.createScene.mockResolvedValue({ id: 'scene-1' })

    const script: ScriptContent = {
      title: 'Test',
      summary: 'Test',
      scenes: [
        {
          sceneNum: 1,
          location: 'Office',
          timeOfDay: 'day',
          characters: ['Alice'],
          description: 'Scene',
          dialogues: [],
          actions: []
        }
      ]
    }

    await callApplyScriptContentToEpisode('ep-1', 'proj-1', 'Title', script)

    expect(mockRepo.createScene).toHaveBeenCalledWith(
      expect.objectContaining({
        aspectRatio: '16:9',
        visualStyle: ['cinematic', 'dramatic']
      })
    )
  })

  it('handles empty scenes array', async () => {
    mockRepo.findProjectForExpandScript.mockResolvedValue(null)
    mockRepo.update.mockResolvedValue({ id: 'ep-1' })

    const script: ScriptContent = {
      title: 'Empty',
      summary: 'No scenes',
      scenes: []
    }

    const result = await service.applyScriptContentToEpisode('ep-1', 'proj-1', 'Title', script)

    expect(result.scenesCreated).toBe(0)
    expect(mockRepo.deleteScenesByEpisode).not.toHaveBeenCalled()
    expect(mockRepo.createScene).not.toHaveBeenCalled()
  })
})
