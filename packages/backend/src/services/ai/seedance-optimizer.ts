/**
 * Seedance 2.0 参数优化服务
 * 将分镜转换为 Seedance API 参数，智能选择参考图
 */

import type {
  StoryboardSegment,
  SeedanceSegmentConfig,
  CharacterImage
} from '@dreamer/shared/types'

export interface SeedanceOptimizerOptions {
  defaultResolution?: '480p' | '720p'
  defaultAspectRatio?: '16:9' | '9:16' | '1:1'
  maxReferenceImages?: number // 最大参考图数量，默认9
  generateAudio?: boolean
}

// 参考图配额分配策略
const REFERENCE_IMAGE_ALLOCATION = {
  character: { min: 2, max: 3, priority: 3 },
  background: { min: 1, max: 2, priority: 2 },
  atmosphere: { min: 1, max: 2, priority: 1 },
  style: { min: 0, max: 1, priority: 1 },
  action: { min: 1, max: 2, priority: 2 },
  reserve: { count: 1 } // 预留位
}

/**
 * 将分镜转换为 Seedance 配置
 */
export function buildSeedanceConfig(
  segment: StoryboardSegment,
  options?: SeedanceOptimizerOptions
): SeedanceSegmentConfig {
  const maxImages = options?.maxReferenceImages || 9

  // 1. 选择参考图（最多9张）
  const selectedImages = selectReferenceImages(segment, maxImages)

  // 2. 确定时长
  const duration = determineDuration(segment)

  // 3. 确定比例
  const aspectRatio = segment.aspectRatio || options?.defaultAspectRatio || '9:16'

  // 4. 确定分辨率
  const resolution = options?.defaultResolution || '720p'

  // 5. 生成最终提示词
  const finalPrompt = enhancePrompt(segment)

  return {
    prompt: finalPrompt,
    imageUrls: selectedImages,
    duration,
    aspectRatio,
    resolution,
    generateAudio: options?.generateAudio ?? true
  }
}

/**
 * 选择参考图（智能分配9张配额）
 */
function selectReferenceImages(segment: StoryboardSegment, maxImages: number): string[] {
  const selected: string[] = []
  const allocations = { ...REFERENCE_IMAGE_ALLOCATION }

  // 1. 首先添加角色参考图（最高优先级）
  for (const char of segment.characters) {
    if (char.referenceImageUrl && selected.length < maxImages) {
      if (allocations.character.min > 0) {
        selected.push(char.referenceImageUrl)
        allocations.character.min--
      } else if (allocations.character.max > 0) {
        selected.push(char.referenceImageUrl)
        allocations.character.max--
      }
    }
  }

  // 2. 从 sceneAssets 中选择
  for (const asset of segment.sceneAssets) {
    if (!asset.url || selected.includes(asset.url)) continue
    if (selected.length >= maxImages) break

    const remainingSlots = maxImages - selected.length
    const reserveCount = allocations.reserve.count

    // 预留位检查
    if (remainingSlots <= reserveCount) {
      // 只添加高优先级的
      if (allocations.background.min > 0 && asset.type === 'background') {
        selected.push(asset.url)
        allocations.background.min--
      } else if (allocations.action.min > 0 && asset.type === 'style') {
        selected.push(asset.url)
        allocations.action.min--
      }
      continue
    }

    // 按类型和优先级添加
    switch (asset.type) {
      case 'background':
        if (allocations.background.max > 0) {
          selected.push(asset.url)
          allocations.background.max--
        }
        break
      case 'atmosphere':
        if (allocations.atmosphere.max > 0) {
          selected.push(asset.url)
          allocations.atmosphere.max--
        }
        break
      case 'style':
        if (allocations.style.max > 0) {
          selected.push(asset.url)
          allocations.style.max--
        }
        break
    }
  }

  return selected
}

/**
 * 确定时长
 */
function determineDuration(segment: StoryboardSegment): SeedanceSegmentConfig['duration'] {
  const duration = segment.duration

  // 限制在 4-15 秒范围内
  if (duration < 4) return 4
  if (duration > 15) return 15

  return duration as SeedanceSegmentConfig['duration']
}

/**
 * 增强提示词
 */
function enhancePrompt(segment: StoryboardSegment): string {
  const parts: string[] = []
  const visualStyle = Array.isArray(segment.visualStyle)
    ? segment.visualStyle.join('，')
    : segment.visualStyle

  // 1. 视觉风格
  parts.push(visualStyle)

  // 2. 添加画质锚定词
  if (
    visualStyle.includes('电影') ||
    visualStyle.includes('史诗') ||
    visualStyle.includes('大片')
  ) {
    parts.push('8K超高清', 'cinematic film grain')
  }

  // 3. 主体描述（角色 + 动作）
  for (const char of segment.characters) {
    const charDesc = [char.name]
    if (char.actions.length > 0) {
      charDesc.push(char.actions[0].description)
    }
    parts.push(charDesc.join('，'))
  }

  // 4. 场景描述
  parts.push(segment.description)

  // 5. 镜头运动
  parts.push(segment.cameraMovement)

  // 6. 环境/光影
  if (segment.timeOfDay === '夜') {
    parts.push('月光/灯光氛围，神秘暗调')
  } else if (segment.timeOfDay === '日') {
    parts.push('自然采光，明亮氛围')
  } else if (segment.timeOfDay === '昏') {
    parts.push('黄昏暖调，柔和光线')
  }

  // 7. 特效
  if (segment.specialEffects.length > 0) {
    parts.push(segment.specialEffects.slice(0, 2).join('，'))
  }

  // 8. 添加一致性约束
  parts.push('保持角色一致性，无变形')

  return parts.join('，')
}

/**
 * 批量转换分镜为 Seedance 配置
 */
export function buildSeedanceConfigs(
  segments: StoryboardSegment[],
  options?: SeedanceOptimizerOptions
): SeedanceSegmentConfig[] {
  return segments.map((segment) => buildSeedanceConfig(segment, options))
}

/**
 * 验证 Seedance 配置
 */
export function validateSeedanceConfig(config: SeedanceSegmentConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // 检查提示词长度
  if (config.prompt.length < 10) {
    errors.push('提示词太短')
  }

  if (config.prompt.length > 1000) {
    errors.push('提示词太长，建议控制在1000字以内')
  }

  // 检查参考图数量
  if (config.imageUrls.length > 9) {
    errors.push('参考图数量不能超过9张')
  }

  // 检查时长
  if (config.duration < 4 || config.duration > 15) {
    errors.push('时长必须在4-15秒之间')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 优化提示词（基于 Seedance 最佳实践）
 */
export function optimizePromptForSeedance(prompt: string): string {
  let optimized = prompt

  // 移除可能导致问题的字符
  optimized = optimized.replace(/[<>]/g, '')

  // 确保使用正确的引用格式
  optimized = optimized.replace(/@图(\d+)/g, '@图片$1')
  optimized = optimized.replace(/@image(\d+)/gi, '@图片$1')

  // 添加默认质量锚定（如果没有）
  if (
    !optimized.includes('cinematic') &&
    !optimized.includes('电影') &&
    !optimized.includes('4K') &&
    !optimized.includes('8K')
  ) {
    optimized += '，cinematic film grain'
  }

  return optimized
}

/**
 * 计算预估成本
 */
export function estimateSeedanceCost(duration: number): number {
  // Seedance 2.0-fast 定价：约 ¥1/秒
  const CNY_PER_SECOND = 1.0
  return duration * CNY_PER_SECOND
}

/**
 * 为角色选择最佳参考图
 */
export function selectBestCharacterImage(
  characterName: string,
  characterImages: CharacterImage[],
  context?: string
): string | undefined {
  // 筛选该角色的图片
  const relevantImages = characterImages.filter(
    (img) =>
      img.characterId &&
      (img.name.includes(characterName) || img.description?.includes(characterName))
  )

  if (relevantImages.length === 0) return undefined

  // 优先选择 base 类型的图片
  const baseImage = relevantImages.find((img) => img.type === 'base')
  if (baseImage?.avatarUrl) return baseImage.avatarUrl

  // 否则选择第一张有 avatarUrl 的
  for (const img of relevantImages) {
    if (img.avatarUrl) return img.avatarUrl
  }

  return undefined
}

/**
 * 生成首帧提示词
 */
export function generateFirstFramePrompt(
  segment: StoryboardSegment,
  characterImageUrl?: string
): string {
  const parts: string[] = []
  const visualStyle = Array.isArray(segment.visualStyle)
    ? segment.visualStyle.join('，')
    : segment.visualStyle

  // 风格
  parts.push(visualStyle)

  // 角色
  for (const char of segment.characters) {
    let charDesc = char.name
    if (char.actions.length > 0) {
      charDesc += '，' + char.actions[0].description.split('，')[0]
    }
    parts.push(charDesc)
  }

  // 场景
  parts.push(segment.location)
  parts.push(segment.timeOfDay)
  parts.push(segment.description.slice(0, 50))

  // 添加参考图提示
  if (characterImageUrl) {
    parts.push('（参考角色形象生成）')
  }

  return parts.join('，')
}

/**
 * 评估提示词质量
 */
export function evaluatePromptQuality(
  prompt: string,
  segment: StoryboardSegment
): {
  score: number
  issues: string[]
  suggestions: string[]
} {
  const issues: string[] = []
  const suggestions: string[] = []

  // 检查基本元素
  if (!prompt.includes(segment.location)) {
    issues.push('未包含场景地点')
    suggestions.push('在提示词中加入场景描述')
  }

  if (segment.characters.length > 0 && !prompt.includes(segment.characters[0].name)) {
    issues.push('未包含角色名称')
    suggestions.push('在提示词中加入角色描述')
  }

  if (!prompt.includes(segment.timeOfDay)) {
    suggestions.push('考虑加入时间段描述')
  }

  if (!prompt.includes('镜头') && !prompt.includes('camera') && !prompt.includes('shot')) {
    suggestions.push('添加镜头运动描述可提升效果')
  }

  // 计算分数
  let score = 100
  score -= issues.length * 15
  score -= suggestions.length * 5
  score = Math.max(0, Math.min(100, score))

  return { score, issues, suggestions }
}
