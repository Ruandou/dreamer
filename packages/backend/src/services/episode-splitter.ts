/**
 * 智能分集服务
 * 将剧本按"起承转合"结构智能分割成多集
 */

import type { ScriptContent, ScriptScene, EpisodePlan } from '@dreamer/shared/types'

// 默认每集目标时长（秒）- 短视频最佳60秒左右
const DEFAULT_EPISODE_DURATION = 60

// 每个场景预估时长（秒）
const ESTIMATED_SCENE_DURATION = 12

export interface EpisodeSplitterOptions {
  targetDuration?: number    // 每集目标时长
  minScenesPerEpisode?: number  // 每集最少场景数
  maxScenesPerEpisode?: number  // 每集最多场景数
}

/**
 * 将剧本智能分集
 */
export function splitIntoEpisodes(
  script: ScriptContent,
  options?: EpisodeSplitterOptions
): EpisodePlan[] {
  const {
    targetDuration = DEFAULT_EPISODE_DURATION,
    minScenesPerEpisode = 2,
    maxScenesPerEpisode = 6
  } = options || {}

  const scenes = script.scenes
  const totalScenes = scenes.length

  // 计算总时长
  const totalDuration = totalScenes * ESTIMATED_SCENE_DURATION

  // 计算集数
  const calculatedEpisodes = Math.ceil(totalDuration / targetDuration)
  const episodeCount = Math.max(1, Math.min(calculatedEpisodes, Math.ceil(totalScenes / minScenesPerEpisode)))

  // 场景分配算法
  const episodes = distributeScenesToEpisodes(
    scenes,
    episodeCount,
    targetDuration,
    minScenesPerEpisode,
    maxScenesPerEpisode
  )

  // 转换为 EpisodePlan 格式
  return episodes.map((episodeScenes, index) => {
    const episodeNum = index + 1
    const synopsis = generateEpisodeSynopsis(episodeScenes, episodeNum)
    const keyMoments = extractKeyMoments(episodeScenes)

    return {
      episodeNum,
      title: `${script.title} 第${episodeNum}集`,
      synopsis,
      sceneCount: episodeScenes.length,
      estimatedDuration: episodeScenes.length * ESTIMATED_SCENE_DURATION,
      keyMoments,
      sceneIndices: episodeScenes.map(s => s.sceneNum - 1)
    }
  })
}

/**
 * 将场景分配到各集
 */
function distributeScenesToEpisodes(
  scenes: ScriptScene[],
  episodeCount: number,
  targetDuration: number,
  minScenes: number,
  maxScenes: number
): ScriptScene[][] {
  const episodes: ScriptScene[][] = []
  const scenesPerEpisode = Math.ceil(scenes.length / episodeCount)

  // 智能分配：按"起承转合"结构分配
  // 起(开头抓人) -> 承(发展) -> 转(高潮/冲突) -> 合(收尾/钩子)

  // 首先识别场景类型
  const sceneTypes = scenes.map((scene, index) => ({
    scene,
    index,
    type: classifyScene(scene, index, scenes.length)
  }))

  // 按结构分配：开头、中间、高潮、结尾
  const openingScenes = sceneTypes.filter(s => s.type === 'opening')
  const climaxScenes = sceneTypes.filter(s => s.type === 'climax')
  const endingScenes = sceneTypes.filter(s => s.type === 'ending')
  const middleScenes = sceneTypes.filter(s => s.type === 'middle')

  // 打乱场景顺序以增加多样性（但保持结构）
  const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)

  // 分配每集的场景
  for (let i = 0; i < episodeCount; i++) {
    const episode: ScriptScene[] = []
    const isFirstEpisode = i === 0
    const isLastEpisode = i === episodeCount - 1
    const isMiddleEpisode = !isFirstEpisode && !isLastEpisode

    // 计算这集应该有多少场景
    let targetSceneCount = scenesPerEpisode

    // 动态调整（只有多场景时才添加额外开场/结尾）
    if (scenes.length > 1) {
      if (isFirstEpisode && openingScenes.length > 0) {
        // 第一集要有开头
        const openingToAdd = Math.min(openingScenes.length, 2)
        for (let j = 0; j < openingToAdd && openingScenes.length > 0; j++) {
          const randomIndex = Math.floor(Math.random() * openingScenes.length)
          episode.push(openingScenes.splice(randomIndex, 1)[0].scene)
        }
      }

      if (isLastEpisode && endingScenes.length > 0) {
        // 最后一集要有结尾
        const endingToAdd = Math.min(endingScenes.length, 2)
        for (let j = 0; j < endingToAdd && endingScenes.length > 0; j++) {
          const randomIndex = Math.floor(Math.random() * endingScenes.length)
          episode.push(endingScenes.splice(randomIndex, 1)[0].scene)
        }
      }
    }

    // 填充中间场景
    while (episode.length < targetSceneCount && middleScenes.length > 0) {
      const randomIndex = Math.floor(Math.random() * middleScenes.length)
      episode.push(middleScenes.splice(randomIndex, 1)[0].scene)
    }

    // 如果还不够，从 climax 和剩余场景补充
    if (episode.length < minScenes && climaxScenes.length > 0) {
      episode.push(climaxScenes.shift()!.scene)
    }

    // 排序按原始顺序
    episode.sort((a, b) => a.sceneNum - b.sceneNum)

    // 确保每集至少有一定数量的场景（使用未使用的场景）
    const usedIndices = new Set(episodes.flat().map(s => s.sceneNum))
    while (episode.length < minScenes) {
      const nextScene = scenes.find(s => !usedIndices.has(s.sceneNum))
      if (nextScene) {
        usedIndices.add(nextScene.sceneNum)
        episode.push(nextScene)
      } else {
        break
      }
    }

    if (episode.length > 0) {
      episodes.push(episode)
    }
  }

  // 处理可能的空集或场景数量不均
  return balanceEpisodes(episodes, minScenes, maxScenes)
}

/**
 * 平衡各集场景数量
 */
function balanceEpisodes(
  episodes: ScriptScene[][],
  minScenes: number,
  maxScenes: number
): ScriptScene[][] {
  // 合并场景过少的集
  const balanced: ScriptScene[][] = []
  let current: ScriptScene[] = []

  for (const episode of episodes) {
    if (current.length + episode.length <= maxScenes) {
      current.push(...episode)
    } else {
      if (current.length >= minScenes) {
        balanced.push(current)
        current = episode
      } else {
        // 场景太少，合并到下一集
        current.push(...episode)
      }
    }
  }

  if (current.length > 0) {
    if (balanced.length > 0 && current.length < minScenes) {
      // 把最后的少量场景合并到上一集
      balanced[balanced.length - 1].push(...current)
    } else {
      balanced.push(current)
    }
  }

  return balanced
}

/**
 * 分类场景类型
 */
function classifyScene(
  scene: ScriptScene,
  index: number,
  totalScenes: number
): 'opening' | 'middle' | 'climax' | 'ending' {
  const ratio = index / totalScenes

  if (ratio < 0.2) {
    return 'opening'
  } else if (ratio > 0.8) {
    return 'ending'
  } else if (hasClimaxIndicators(scene)) {
    return 'climax'
  } else {
    return 'middle'
  }
}

/**
 * 检查场景是否有高潮指标
 */
function hasClimaxIndicators(scene: ScriptScene): boolean {
  const text = [
    scene.description,
    ...scene.dialogues.map(d => d.content),
    ...scene.actions
  ].join(' ').toLowerCase()

  const climaxKeywords = [
    '爆发', '冲突', '对决', '表白', '揭露', '真相',
    '转折', '震惊', '高潮', '决定', '战斗', '争吵',
    'cry', 'explosion', 'fight', 'revelation', 'climax'
  ]

  return climaxKeywords.some(keyword => text.includes(keyword))
}

/**
 * 生成本集梗概
 */
function generateEpisodeSynopsis(scenes: ScriptScene[], episodeNum: number): string {
  if (scenes.length === 0) return ''

  // 提取主要角色
  const allCharacters = new Set<string>()
  scenes.forEach(s => s.characters.forEach(c => allCharacters.add(c)))
  const mainCharacters = Array.from(allCharacters).slice(0, 3)

  // 提取关键动作
  const keyActions = scenes
    .flatMap(s => s.actions)
    .slice(0, 2)

  // 提取场景地点
  const locations = [...new Set(scenes.map(s => s.location))].slice(0, 2)

  // 构建梗概
  const parts: string[] = []

  if (mainCharacters.length > 0) {
    parts.push(`主要角色：${mainCharacters.join('、')}`)
  }

  if (locations.length > 0) {
    parts.push(`场景：${locations.join('、')}`)
  }

  if (keyActions.length > 0) {
    parts.push(`关键动作：${keyActions.join('；')}`)
  }

  return parts.join('。') + '。'
}

/**
 * 提取关键画面
 */
function extractKeyMoments(scenes: ScriptScene[]): string[] {
  const moments: string[] = []

  for (const scene of scenes) {
    // 使用场景描述作为关键画面
    if (scene.description && scene.description.length > 10) {
      moments.push(scene.description.slice(0, 50) + (scene.description.length > 50 ? '...' : ''))
    }

    // 提取关键对话
    const importantDialogues = scene.dialogues
      .filter(d => d.content.length > 10)
      .slice(0, 1)
      .map(d => `${d.character}：${d.content.slice(0, 30)}...`)

    moments.push(...importantDialogues)
  }

  // 只返回前5个最关键的
  return moments.slice(0, 5)
}

/**
 * 计算单集时长
 */
export function calculateEpisodeDuration(sceneCount: number): number {
  return sceneCount * ESTIMATED_SCENE_DURATION
}

/**
 * 计算总剧集时长
 */
export function calculateTotalDuration(episodes: EpisodePlan[]): number {
  return episodes.reduce((sum, ep) => sum + ep.estimatedDuration, 0)
}

/**
 * 优化分集方案
 */
export function optimizeEpisodePlan(
  episodes: EpisodePlan[],
  targetTotalDuration?: number
): EpisodePlan[] {
  if (!targetTotalDuration) return episodes

  const currentTotal = calculateTotalDuration(episodes)
  const ratio = targetTotalDuration / currentTotal

  if (ratio > 1) {
    // 需要加长：增加每集场景数或添加新集
    return expandEpisodes(episodes, ratio)
  } else if (ratio < 1) {
    // 需要压缩：减少场景或合并集数
    return compressEpisodes(episodes, ratio)
  }

  return episodes
}

function expandEpisodes(episodes: EpisodePlan[], ratio: number): EpisodePlan[] {
  // 简化处理：返回原计划
  return episodes
}

function compressEpisodes(episodes: EpisodePlan[], ratio: number): EpisodePlan[] {
  // 简化处理：返回原计划
  return episodes
}
