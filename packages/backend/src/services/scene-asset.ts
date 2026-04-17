/**
 * 场景素材关联服务
 * 分析场景需求，匹配素材，生成素材提示词
 */

import type {
  ScriptScene,
  SceneAsset,
  SceneAssetRecommendation,
  SceneActions,
  CharacterImage
} from '@dreamer/shared/types'
import {
  ASSET_PRIORITY,
  ASSET_RELEVANCE,
  MAX_ASSETS_PER_SCENE,
  MAX_REFERENCE_IMAGES,
  STYLE_KEYWORDS,
  TIME_ATMOSPHERE_MAP,
  DEFAULT_TIME_OF_DAY,
  DEFAULT_VIDEO_STYLE,
  DEFAULT_STYLE_TYPE,
  MIN_KEYWORD_LENGTH
} from './scene-asset.constants.js'

export interface ProjectAsset {
  id: string
  type: 'character' | 'background' | 'atmosphere' | 'prop' | 'style'
  name: string
  url: string
  description?: string
  tags?: string[]
  mood?: string[]
  location?: string
}

export interface SceneAssetMatcherOptions {
  maxAssetsPerScene?: number  // 每场景最多素材数
  maxReferenceImages?: number  // 最多参考图数量
}

/**
 * 分析场景需要的素材类型
 */
export function analyzeSceneRequirements(
  scene: ScriptScene,
  sceneActions?: SceneActions
): {
  requiredTypes: SceneAsset['type'][]
  suggestedAssets: Partial<SceneAsset>[]
  priority: number
} {
  const requiredTypes: SceneAsset['type'][] = []
  const suggestedAssets: Partial<SceneAsset>[] = []
  let priority = 1

  // 1. 角色形象（必须有）
  if (scene.characters.length > 0) {
    requiredTypes.push('character')
    suggestedAssets.push({
      type: 'character',
      description: `角色形象：${scene.characters.join('、')}`
    })
    priority = ASSET_PRIORITY.CHARACTER // 高优先级
  }

  // 2. 背景素材（根据场景描述）
  if (scene.location) {
    requiredTypes.push('background')
    suggestedAssets.push({
      type: 'background',
      description: `场景背景：${scene.location}`
    })
    priority = Math.max(priority, ASSET_PRIORITY.BACKGROUND)
  }

  // 3. 氛围素材（根据时间和情绪）
  if (scene.timeOfDay) {
    requiredTypes.push('atmosphere')
    suggestedAssets.push({
      type: 'atmosphere',
      description: `氛围：${scene.timeOfDay}时段的${sceneActions?.videoStyle || 'mixed'}风格`,
      mood: [scene.timeOfDay, sceneActions?.videoStyle || 'mixed']
    })
  }

  // 4. 风格素材（如果有特殊风格要求）
  for (const keyword of STYLE_KEYWORDS) {
    if (scene.description.includes(keyword)) {
      requiredTypes.push('style')
      suggestedAssets.push({
        type: 'style',
        description: `风格参考：${keyword}`,
        applicableGenres: [keyword]
      })
      break
    }
  }

  return { requiredTypes, suggestedAssets, priority }
}

/**
 * 匹配项目已有素材
 */
export function matchAssets(
  scene: ScriptScene,
  projectAssets: ProjectAsset[],
  sceneActions?: SceneActions,
  options?: SceneAssetMatcherOptions
): SceneAssetRecommendation {
  const maxAssets = options?.maxAssetsPerScene || MAX_ASSETS_PER_SCENE
  const { requiredTypes, suggestedAssets } = analyzeSceneRequirements(scene, sceneActions)

  const recommendedAssets: SceneAssetRecommendation['recommendedAssets'] = []
  const usedUrls = new Set<string>()

  // 1. 首先匹配角色素材（最重要）
  for (const character of scene.characters) {
    const characterAssets = projectAssets.filter(
      a => a.type === 'character' &&
           a.name.includes(character) &&
           !usedUrls.has(a.url)
    )

    if (characterAssets.length > 0) {
      // 取第一张作为参考
      const asset = characterAssets[0]
      recommendedAssets.push({
        asset: {
          id: asset.id,
          type: 'character',
          url: asset.url,
          description: asset.description || asset.name
        },
        relevance: ASSET_RELEVANCE.CHARACTER_MATCH,
        usage: 'reference'
      })
      usedUrls.add(asset.url)
    }
  }

  // 2. 匹配背景素材
  const backgroundAssets = projectAssets.filter(
    a => a.type === 'background' &&
         (a.location?.includes(scene.location) || !a.location) &&
         !usedUrls.has(a.url)
  )

  if (backgroundAssets.length > 0) {
    recommendedAssets.push({
      asset: {
        id: backgroundAssets[0].id,
        type: 'background',
        url: backgroundAssets[0].url,
        description: backgroundAssets[0].description || backgroundAssets[0].name
      },
      relevance: calculateLocationRelevance(scene.location, backgroundAssets[0].location),
      usage: 'background'
    })
    usedUrls.add(backgroundAssets[0].url)
  }

  // 3. 匹配氛围素材
  const atmosphereAssets = projectAssets.filter(
    a => a.type === 'atmosphere' &&
         (!scene.timeOfDay || a.mood?.includes(scene.timeOfDay)) &&
         !usedUrls.has(a.url)
  )

  if (atmosphereAssets.length > 0) {
    recommendedAssets.push({
      asset: {
        id: atmosphereAssets[0].id,
        type: 'atmosphere',
        url: atmosphereAssets[0].url,
        description: atmosphereAssets[0].description || atmosphereAssets[0].name
      },
      relevance: ASSET_RELEVANCE.ATMOSPHERE_MATCH,
      usage: 'atmosphere'
    })
    usedUrls.add(atmosphereAssets[0].url)
  }

  // 4. 匹配风格素材
  const styleAssets = projectAssets.filter(
    a => a.type === 'style' &&
         sceneActions?.videoStyle &&
         a.tags?.some(tag =>
           sceneActions.videoStyle?.includes(tag.toLowerCase())
         ) &&
         !usedUrls.has(a.url)
  )

  if (styleAssets.length > 0) {
    recommendedAssets.push({
      asset: {
        id: styleAssets[0].id,
        type: 'style',
        url: styleAssets[0].url,
        description: styleAssets[0].description || styleAssets[0].name
      },
      relevance: ASSET_RELEVANCE.STYLE_MATCH,
      usage: 'style'
    })
  }

  // 5. 生成组合提示词
  const compositePrompt = generateCompositePrompt(scene, recommendedAssets.map(r => r.asset))

  return {
    sceneNum: scene.sceneNum,
    recommendedAssets: recommendedAssets.slice(0, maxAssets),
    compositePrompt
  }
}

/**
 * 生成组合素材提示词
 */
export function generateCompositePrompt(
  scene: ScriptScene,
  assets: SceneAsset[]
): string {
  const parts: string[] = []

  // 1. 添加场景信息
  parts.push(`场景：${scene.location || '未指定'}，${scene.timeOfDay || '时间未指定'}`)

  // 2. 按类型添加素材信息
  const characterAssets = assets.filter(a => a.type === 'character')
  const backgroundAssets = assets.filter(a => a.type === 'background')
  const atmosphereAssets = assets.filter(a => a.type === 'atmosphere')

  if (characterAssets.length > 0) {
    const descriptions = characterAssets.map(a => a.description).filter(Boolean)
    if (descriptions.length > 0) {
      parts.push(`角色：${descriptions.join('，')}`)
    }
  }

  if (backgroundAssets.length > 0) {
    const locations = backgroundAssets.map(a => a.description).filter(Boolean)
    if (locations.length > 0) {
      parts.push(`背景：${locations.join('，')}`)
    }
  }

  if (atmosphereAssets.length > 0) {
    const moods = atmosphereAssets.flatMap(a => a.mood || []).filter(Boolean)
    if (moods.length > 0) {
      parts.push(`氛围：${moods.join('，')}`)
    }
  }

  return parts.join('。') + '。'
}

/**
 * 建议素材生成
 */
export function suggestAssetGeneration(
  scene: ScriptScene,
  sceneActions?: SceneActions
): Array<{
  assetType: SceneAsset['type']
  prompt: string
  priority: number
}> {
  const suggestions: Array<{
    assetType: SceneAsset['type']
    prompt: string
    priority: number
  }> = []

  // 1. 角色形象生成建议
  for (const character of scene.characters) {
    suggestions.push({
      assetType: 'character',
      prompt: generateCharacterPrompt(character, scene),
      priority: ASSET_PRIORITY.CHARACTER
    })
  }

  // 2. 背景图生成建议
  if (scene.location) {
    suggestions.push({
      assetType: 'background',
      prompt: generateBackgroundPrompt(scene),
      priority: ASSET_PRIORITY.BACKGROUND
    })
  }

  // 3. 氛围图生成建议
  suggestions.push({
    assetType: 'atmosphere',
    prompt: generateAtmospherePrompt(scene, sceneActions),
    priority: ASSET_PRIORITY.ATMOSPHERE
  })

  return suggestions.sort((a, b) => b.priority - a.priority)
}

/**
 * 生成角色提示词
 */
function generateCharacterPrompt(
  characterName: string,
  scene: ScriptScene
): string {
  const style = scene.description.includes('古风') ? '古风' :
                scene.description.includes('现代') ? '现代' :
                scene.description.includes('科幻') ? '科幻' : DEFAULT_STYLE_TYPE

  return `${style}${characterName}，${scene.timeOfDay || DEFAULT_TIME_OF_DAY}时场景，${scene.location || '通用场景'}，${scene.description.slice(0, 50)}`
}

/**
 * 生成背景提示词
 */
function generateBackgroundPrompt(scene: ScriptScene): string {
  return `${scene.location || '场景'}，${scene.timeOfDay || DEFAULT_TIME_OF_DAY}时，${scene.description.slice(0, 100)}`
}

/**
 * 生成氛围提示词
 */
function generateAtmospherePrompt(
  scene: ScriptScene,
  sceneActions?: SceneActions
): string {
  const timeOfDay = scene.timeOfDay || DEFAULT_TIME_OF_DAY
  const style = sceneActions?.videoStyle || DEFAULT_VIDEO_STYLE

  return `${scene.location || '场景'}，${TIME_ATMOSPHERE_MAP[timeOfDay] || timeOfDay}，${style}风格`
}

/**
 * 计算位置相关度
 */
function calculateLocationRelevance(
  sceneLocation: string,
  assetLocation?: string
): number {
  if (!assetLocation) return ASSET_RELEVANCE.UNKNOWN_LOCATION

  const sceneLower = sceneLocation.toLowerCase()
  const assetLower = assetLocation.toLowerCase()

  if (sceneLower === assetLower) return ASSET_RELEVANCE.EXACT_MATCH
  if (sceneLower.includes(assetLower) || assetLower.includes(sceneLower)) return ASSET_RELEVANCE.CONTAINS_MATCH

  // 检查关键词匹配
  const sceneWords = sceneLower.split(/[，。、\s]+/)
  const assetWords = assetLower.split(/[，。、\s]+/)
  const commonWords = sceneWords.filter(w => assetWords.includes(w) && w.length > MIN_KEYWORD_LENGTH)

  if (commonWords.length > 0) return ASSET_RELEVANCE.KEYWORD_MATCH

  return ASSET_RELEVANCE.PARTIAL_MATCH
}

/**
 * 批量匹配场景素材
 */
export function matchAssetsForScenes(
  scenes: ScriptScene[],
  projectAssets: ProjectAsset[],
  sceneActions?: SceneActions[]
): SceneAssetRecommendation[] {
  return scenes.map((scene, index) => {
    const actions = sceneActions?.[index]
    return matchAssets(scene, projectAssets, actions)
  })
}

/**
 * 将 CharacterImage 转换为 ProjectAsset 格式
 */
export function convertCharacterImagesToAssets(
  characterImages: CharacterImage[]
): ProjectAsset[] {
  return characterImages.map(img => ({
    id: img.id,
    type: 'character' as const,
    name: img.name,
    url: img.avatarUrl || '',
    description: img.description,
    tags: [img.type]
  }))
}

/**
 * 获取用于 Seedance 的参考图 URL 列表（最多9张）
 */
export function getReferenceImageUrls(
  recommendations: SceneAssetRecommendation[],
  maxImages: number = MAX_REFERENCE_IMAGES
): string[] {
  const urls: string[] = []

  // 按优先级添加 URL
  for (const rec of recommendations) {
    for (const item of rec.recommendedAssets) {
      if (item.asset.url && urls.length < maxImages) {
        urls.push(item.asset.url)
      }
    }
  }

  return urls
}
