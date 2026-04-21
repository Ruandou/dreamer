/**
 * 分镜生成服务
 * 将场景、动作、素材组合成分镜片段
 */

import type {
  ScriptScene,
  StoryboardSegment,
  SceneActions,
  SceneAsset,
  SceneAssetRecommendation,
  EpisodePlan,
  CharacterAction
} from '@dreamer/shared/types'
import { extractActionsFromScene } from './action-extractor.js'
import {
  determineVisualStyle,
  determineCameraMovement,
  determineSpecialEffects
} from './storyboard/style-detectors.js'
import { generateSeedancePrompt } from './storyboard/prompt-builder.js'
import { buildVoiceSegments } from './storyboard/voice-builder.js'

export interface StoryboardGeneratorOptions {
  defaultAspectRatio?: '16:9' | '9:16' | '1:1'
  defaultResolution?: '480p' | '720p'
  enableDialogueFormat?: boolean // 是否启用对话格式
}

/**
 * 从单集生成分镜
 */
export function generateStoryboard(
  episodePlan: EpisodePlan,
  scenes: ScriptScene[],
  assetRecommendations?: SceneAssetRecommendation[],
  options?: StoryboardGeneratorOptions
): StoryboardSegment[] {
  const segments: StoryboardSegment[] = []
  const aspectRatio = options?.defaultAspectRatio || '9:16'

  // 获取本集对应的场景
  const episodeScenes = episodePlan.sceneIndices
    ? episodePlan.sceneIndices.map((i) => scenes[i]).filter(Boolean)
    : scenes.slice(0, episodePlan.sceneCount)

  for (let i = 0; i < episodeScenes.length; i++) {
    const scene = episodeScenes[i]
    const sceneActions = extractActionsFromScene(scene)
    const assets = assetRecommendations?.find((a) => a.sceneNum === scene.sceneNum)

    const segment = createSegment(
      episodePlan.episodeNum,
      i + 1,
      scene,
      sceneActions,
      assets?.recommendedAssets.map((r) => r.asset) || [],
      aspectRatio,
      options
    )

    segments.push(segment)
  }

  return segments
}

/**
 * 创建单个分镜片段
 */
function createSegment(
  episodeNum: number,
  segmentNum: number,
  scene: ScriptScene,
  sceneActions: SceneActions,
  assets: SceneAsset[],
  aspectRatio: '16:9' | '9:16' | '1:1',
  options?: StoryboardGeneratorOptions
): StoryboardSegment {
  // 构建角色信息
  const characters = buildCharacterInfo(scene, sceneActions, assets)

  // 构建视觉风格
  const visualStyle = determineVisualStyle(scene, sceneActions)

  // 构建镜头运动
  const cameraMovement = determineCameraMovement(scene, sceneActions)

  // 构建特效
  const specialEffects = determineSpecialEffects(scene)

  // 生成语音片段
  const voiceSegments = buildVoiceSegments(scene, characters, sceneActions)

  // 生成基础提示词
  const seedancePrompt = generateSeedancePrompt(
    scene,
    sceneActions,
    characters,
    visualStyle,
    cameraMovement,
    assets,
    options
  )

  // 获取参考图 URL
  const compositeImageUrls = assets.filter((a) => a.url).map((a) => a.url as string)

  return {
    episodeNum,
    segmentNum,
    description: scene.description,
    duration: sceneActions.suggestedDuration,
    aspectRatio: sceneActions.suggestedAspectRatio || aspectRatio,
    characters,
    location: scene.location,
    timeOfDay: scene.timeOfDay,
    visualStyle,
    cameraMovement,
    specialEffects,
    seedancePrompt,
    contextForNext: generateContextForNext(scene, segmentNum),
    sceneAssets: assets,
    compositeImageUrls,
    voiceSegments
  }
}

/**
 * 构建角色信息
 */
function buildCharacterInfo(
  scene: ScriptScene,
  sceneActions: SceneActions,
  assets: SceneAsset[]
): StoryboardSegment['characters'] {
  const characterActions = new Map<string, CharacterAction[]>()

  // 按角色分组动作
  for (const action of sceneActions.actions) {
    if (!characterActions.has(action.characterName)) {
      characterActions.set(action.characterName, [])
    }
    characterActions.get(action.characterName)?.push(action)
  }

  // 构建角色信息
  const characters: StoryboardSegment['characters'] = []

  for (const characterName of scene.characters) {
    const actions = characterActions.get(characterName) || []
    const characterAsset = assets.find(
      (a) => a.type === 'character' && a.description?.includes(characterName)
    )

    characters.push({
      name: characterName,
      actions,
      referenceImageUrl: characterAsset?.url
    })
  }

  return characters
}

/**
 * 生成分镜间的衔接提示
 */
function generateContextForNext(currentScene: ScriptScene, _segmentNum: number): string {
  const hints: string[] = []

  // 如果有对话，提示下一镜接续情绪
  if (currentScene.dialogues.length > 0) {
    const lastDialogue = currentScene.dialogues[currentScene.dialogues.length - 1]
    hints.push(`衔接上一句"${lastDialogue.content.slice(0, 20)}..."的情绪`)
  }

  // 提示角色动作连续性
  if (currentScene.actions.length > 0) {
    hints.push(`继续${currentScene.characters[0] || '角色'}的动作`)
  }

  return hints.length > 0 ? hints.join('；') : '自然衔接'
}

/**
 * 优化分镜提示词（调用 AI）
 */
export async function enhancePromptWithAI(segment: StoryboardSegment): Promise<string> {
  // TODO: 调用 DeepSeek 优化提示词
  // 暂时返回原始提示词
  return segment.seedancePrompt
}
