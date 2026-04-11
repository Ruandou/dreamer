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
import { matchAssets, getReferenceImageUrls } from './scene-asset.js'

export interface StoryboardGeneratorOptions {
  defaultAspectRatio?: '16:9' | '9:16' | '1:1'
  defaultResolution?: '480p' | '720p'
  enableDialogueFormat?: boolean  // 是否启用对话格式
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
    ? episodePlan.sceneIndices.map(i => scenes[i]).filter(Boolean)
    : scenes.slice(0, episodePlan.sceneCount)

  for (let i = 0; i < episodeScenes.length; i++) {
    const scene = episodeScenes[i]
    const sceneActions = extractActionsFromScene(scene)
    const assets = assetRecommendations?.find(a => a.sceneNum === scene.sceneNum)

    const segment = createSegment(
      episodePlan.episodeNum,
      i + 1,
      scene,
      sceneActions,
      assets?.recommendedAssets.map(r => r.asset) || [],
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
  const compositeImageUrls = assets
    .filter(a => a.url)
    .map(a => a.url!)

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
    compositeImageUrls
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
    characterActions.get(action.characterName)!.push(action)
  }

  // 构建角色信息
  const characters: StoryboardSegment['characters'] = []

  for (const characterName of scene.characters) {
    const actions = characterActions.get(characterName) || []
    const characterAsset = assets.find(
      a => a.type === 'character' &&
           a.description?.includes(characterName)
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
 * 确定视觉风格
 */
function determineVisualStyle(
  scene: ScriptScene,
  sceneActions: SceneActions
): string[] {
  const styles: string[] = []

  // 根据时代/题材
  if (scene.description.includes('古风') || scene.description.includes('古装')) {
    styles.push('古风', '中国风')
  }
  if (scene.description.includes('现代')) {
    styles.push('现代都市')
  }
  if (scene.description.includes('科幻') || scene.description.includes('未来')) {
    styles.push('科幻', '赛博朋克')
  }
  if (scene.description.includes('仙侠')) {
    styles.push('仙侠', '玄幻')
  }

  // 根据时间
  if (scene.timeOfDay === '夜') {
    styles.push('夜景氛围', '暗色调')
  } else if (scene.timeOfDay === '日') {
    styles.push('明亮色调')
  } else if (scene.timeOfDay === '昏') {
    styles.push('黄昏暖调')
  }

  // 根据视频风格
  if (sceneActions.videoStyle === 'action') {
    styles.push('动感', '高对比')
  } else if (sceneActions.videoStyle === 'dialogue') {
    styles.push('柔和', '浅景深')
  }

  return styles.length > 0 ? styles : ['电影感']
}

/**
 * 确定镜头运动
 */
function determineCameraMovement(
  scene: ScriptScene,
  sceneActions: SceneActions
): string {
  // 如果已有建议，使用建议
  if (sceneActions.suggestedCameraMovement) {
    return sceneActions.suggestedCameraMovement
  }

  const movements: string[] = []

  // 根据视频风格建议
  switch (sceneActions.videoStyle) {
    case 'dialogue':
      movements.push('Medium close-up', 'subtle push-in on speaker')
      break
    case 'action':
      movements.push('Dynamic tracking shot', 'smooth dolly follow')
      break
    case 'landscape':
      movements.push('Slow wide pan', 'aerial crane reveal')
      break
    default:
      movements.push('Medium shot', 'gentle tracking movement')
  }

  // 根据场景特点微调
  if (scene.characters.length > 2) {
    movements.push('group framing')
  }

  return movements.join(', ')
}

/**
 * 确定特效
 */
function determineSpecialEffects(scene: ScriptScene): string[] {
  const effects: string[] = []

  // 根据描述词
  const effectKeywords: [string, string][] = [
    ['雨', '雨水效果'],
    ['雪', '飘雪效果'],
    ['雾', '薄雾弥漫'],
    ['风', '风吹效果'],
    ['光', '光束效果'],
    ['火', '火焰效果'],
    ['爆炸', '爆炸粒子'],
    ['慢动作', '升格拍摄'],
    ['雨滴', '雨滴溅射']
  ]

  for (const [keyword, effect] of effectKeywords) {
    if (scene.description.includes(keyword)) {
      effects.push(effect)
    }
  }

  return effects
}

/**
 * 生成 Seedance 提示词
 */
function generateSeedancePrompt(
  scene: ScriptScene,
  sceneActions: SceneActions,
  characters: StoryboardSegment['characters'],
  visualStyle: string | string[],
  cameraMovement: string,
  assets: SceneAsset[],
  options?: StoryboardGeneratorOptions
): string {
  const parts: string[] = []
  const styleStr = Array.isArray(visualStyle) ? visualStyle.join('，') : visualStyle

  // 1. 风格/色调总纲
  parts.push(styleStr)

  // 2. 主体描述
  const characterDescriptions = characters.map(c => {
    const desc = [c.name]
    if (c.actions.length > 0) {
      const mainAction = c.actions[0]
      desc.push(mainAction.description)
    }
    // 添加参考图标记
    const asset = assets.find(a => a.url === c.referenceImageUrl)
    if (asset) {
      const index = assets.filter(a => a.url).indexOf(asset) + 1
      desc.push(`@图片${index}`)
    }
    return desc.join('，')
  })
  parts.push(characterDescriptions.join('，'))

  // 3. 场景描述
  parts.push(scene.description)

  // 4. 镜头语言
  parts.push(cameraMovement)

  // 5. 环境/光影
  if (scene.timeOfDay === '夜') {
    parts.push('月光/灯光照明，神秘氛围')
  } else if (scene.timeOfDay === '日') {
    parts.push('自然采光，明亮氛围')
  }

  // 6. 添加素材信息
  const backgroundAsset = assets.find(a => a.type === 'background')
  if (backgroundAsset?.url) {
    const index = assets.filter(a => a.url).indexOf(backgroundAsset) + 1
    parts.push(`背景参考 @图片${index}`)
  }

  // 7. 音效描述（如果有对话）
  if (scene.dialogues.length > 0 && options?.enableDialogueFormat) {
    parts.push('音效：对话为主，环境音为辅')
  }

  return parts.join('，')
}

/**
 * 生成分镜间的衔接提示
 */
function generateContextForNext(
  currentScene: ScriptScene,
  segmentNum: number
): string {
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
export async function enhancePromptWithAI(
  segment: StoryboardSegment
): Promise<string> {
  // TODO: 调用 DeepSeek 优化提示词
  // 暂时返回原始提示词
  return segment.seedancePrompt
}

/**
 * 将分镜导出为文本格式
 */
export function exportStoryboardAsText(
  segments: StoryboardSegment[]
): string {
  const lines: string[] = []

  lines.push('# 分镜脚本')
  lines.push('')

  for (const segment of segments) {
    lines.push(`## 分镜 ${segment.episodeNum}-${segment.segmentNum}`)
    lines.push(`时长：${segment.duration}秒`)
    lines.push(`场景：${segment.location}，${segment.timeOfDay}`)
    lines.push(`角色：${segment.characters.map(c => c.name).join('、')}`)
    lines.push('')
    lines.push('### 描述')
    lines.push(segment.description)
    lines.push('')
    lines.push('### 提示词')
    lines.push(segment.seedancePrompt)
    lines.push('')
    lines.push('### 参考图')
    if (segment.compositeImageUrls.length > 0) {
      segment.compositeImageUrls.forEach((url, i) => {
        lines.push(`- @图片${i + 1}: ${url}`)
      })
    } else {
      lines.push('（无参考图）')
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 将分镜导出为 JSON 格式
 */
export function exportStoryboardAsJSON(
  segments: StoryboardSegment[]
): string {
  return JSON.stringify(segments, null, 2)
}
