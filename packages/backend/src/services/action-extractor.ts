/**
 * 角色动作提取服务
 * 从剧本场景中提取角色动作、情绪等信息
 */

import type { ScriptScene, CharacterAction, SceneActions, Character } from '@dreamer/shared/types'

export interface ActionExtractorOptions {
  maxActionsPerCharacter?: number  // 每个角色最多提取的动作数
  includeEmotions?: boolean       // 是否提取情绪信息
}

/**
 * 从场景中提取角色动作
 */
export function extractActionsFromScene(
  scene: ScriptScene,
  characters?: Character[],
  options?: ActionExtractorOptions
): SceneActions {
  const maxActions = options?.maxActionsPerCharacter || 5

  const actions: CharacterAction[] = []

  // 提取对话动作
  for (const dialogue of scene.dialogues) {
    const action: CharacterAction = {
      characterName: dialogue.character,
      actionType: 'dialogue',
      description: dialogue.content,
      emotion: inferEmotionFromDialogue(dialogue.content)
    }
    actions.push(action)
  }

  // 提取描述性动作
  for (const actionText of scene.actions) {
    // 尝试识别动作类型和执行者
    const parsed = parseActionText(actionText, scene.characters)
    if (parsed) {
      actions.push({
        ...parsed,
        emotion: inferEmotionFromAction(actionText)
      })
    }
  }

  // 从场景描述中提取隐含动作
  const impliedActions = extractImpliedActions(scene.description, scene.characters)
  actions.push(...impliedActions)

  // 按角色分组并限制数量
  const groupedActions = groupActionsByCharacter(actions, maxActions)

  // 确定视频风格
  const videoStyle = determineVideoStyle(scene, groupedActions)

  // 确定建议时长
  const suggestedDuration = calculateSuggestedDuration(scene, groupedActions)

  return {
    sceneNum: scene.sceneNum,
    actions: groupedActions,
    suggestedDuration,
    videoStyle,
    suggestedCameraMovement: suggestCameraMovement(videoStyle),
    suggestedAspectRatio: '9:16' // 短视频默认竖屏
  }
}

/**
 * 从多个场景中提取动作
 */
export function extractActionsFromScenes(
  scenes: ScriptScene[],
  characters?: Character[],
  options?: ActionExtractorOptions
): SceneActions[] {
  return scenes.map(scene => extractActionsFromScene(scene, characters, options))
}

/**
 * 解析动作文本
 */
function parseActionText(
  actionText: string,
  characters: string[]
): CharacterAction | null {
  // 尝试匹配 "角色：动作" 格式
  for (const character of characters) {
    if (actionText.includes(character)) {
      const actionType = classifyActionType(actionText)
      return {
        characterName: character,
        actionType,
        description: actionText,
        emotion: inferEmotionFromAction(actionText)
      }
    }
  }

  // 无法确定角色，作为通用动作处理
  return null
}

/**
 * 分类动作类型
 */
function classifyActionType(actionText: string): CharacterAction['actionType'] {
  const lowerText = actionText.toLowerCase()

  // 对话类关键词
  if (lowerText.includes('说') || lowerText.includes('道') ||
      lowerText.includes('喊') || lowerText.includes('叫') ||
      lowerText.includes('ask') || lowerText.includes('say')) {
    return 'dialogue'
  }

  // 表情类关键词
  if (lowerText.includes('看') || lowerText.includes('望') ||
      lowerText.includes('笑') || lowerText.includes('哭') ||
      lowerText.includes('look') || lowerText.includes('smile') ||
      lowerText.includes('cry')) {
    return 'expression'
  }

  // 移动类关键词
  if (lowerText.includes('走') || lowerText.includes('跑') ||
      lowerText.includes('跳') || lowerText.includes('坐') ||
      lowerText.includes('walk') || lowerText.includes('run') ||
      lowerText.includes('jump') || lowerText.includes('sit')) {
    return 'movement'
  }

  // 反应类关键词
  if (lowerText.includes('惊') || lowerText.includes('愣') ||
      lowerText.includes('反应') || lowerText.includes('surprise') ||
      lowerText.includes('react')) {
    return 'reaction'
  }

  // 默认按动作处理
  return 'movement'
}

/**
 * 从对话中推断情绪
 */
function inferEmotionFromDialogue(dialogue: string): string {
  const lowerText = dialogue.toLowerCase()

  // 强烈情绪词
  if (lowerText.includes('!') || lowerText.includes('！') ||
      lowerText.includes('震惊') || lowerText.includes('惊讶')) {
    return '震惊'
  }

  if (lowerText.includes('哭') || lowerText.includes('泪') ||
      lowerText.includes('cry') || lowerText.includes('tear')) {
    return '悲伤'
  }

  if (lowerText.includes('笑') || lowerText.includes('开心') ||
      lowerText.includes('happy') || lowerText.includes('joy')) {
    return '开心'
  }

  if (lowerText.includes('怒') || lowerText.includes('气愤') ||
      lowerText.includes('angry')) {
    return '愤怒'
  }

  if (lowerText.includes('爱') || lowerText.includes('喜欢') ||
      lowerText.includes('love')) {
    return '爱慕'
  }

  return '平静'
}

/**
 * 从动作文本中推断情绪
 */
function inferEmotionFromAction(actionText: string): string {
  const lowerText = actionText.toLowerCase()

  const emotionKeywords: [string, string][] = [
    ['颤抖', '紧张'], ['颤抖', 'nervous'],
    ['流泪', '悲伤'], ['cry', 'sad'],
    ['微笑', '开心'], ['smile', 'happy'],
    ['大笑', '欢乐'], ['laugh', 'joy'],
    ['皱眉', '忧虑'], ['frown', 'worried'],
    ['抬头', '坚定'], ['抬头', 'determined'],
    ['低头', '沮丧'], ['低头', 'depressed'],
    ['握拳', '愤怒'], ['clench', 'angry'],
    ['拥抱', '亲密'], ['hug', 'intimate'],
    ['挥手', '告别'], ['wave', 'goodbye']
  ]

  for (const [keyword, emotion] of emotionKeywords) {
    if (lowerText.includes(keyword)) {
      return emotion
    }
  }

  return '中性'
}

/**
 * 从场景描述中提取隐含动作
 */
function extractImpliedActions(
  description: string,
  characters: string[]
): CharacterAction[] {
  const actions: CharacterAction[] = []

  // 从描述中识别动作模式
  const actionPatterns = [
    // 表情模式
    { regex: /([^，,。\s]+)低着头|([^，,。\s]+)抬起头|([^，,。\s]+)微笑着|([^，,。\s]+)眼中含着泪/g, type: 'expression' as const },
    // 动作模式
    { regex: /([^，,。\s]+)走进|([^，,。\s]+)冲出|([^，,。\s]+)站在/g, type: 'movement' as const },
    // 反应模式
    { regex: /([^，,。\s]+)惊讶|([^，,。\s]+)愣住|([^，,。\s]+)反应过来/g, type: 'reaction' as const }
  ]

  for (const pattern of actionPatterns) {
    let match
    while ((match = pattern.regex.exec(description)) !== null) {
      const characterName = match[1] || match[2] || match[3] || match[4]
      // 确认是已知角色
      if (characters.includes(characterName)) {
        actions.push({
          characterName,
          actionType: pattern.type,
          description: match[0],
          emotion: inferEmotionFromAction(match[0])
        })
      }
    }
  }

  return actions
}

/**
 * 按角色分组动作
 */
function groupActionsByCharacter(
  actions: CharacterAction[],
  maxPerCharacter: number
): CharacterAction[] {
  const grouped = new Map<string, CharacterAction[]>()

  // 分组
  for (const action of actions) {
    if (!grouped.has(action.characterName)) {
      grouped.set(action.characterName, [])
    }
    grouped.get(action.characterName)!.push(action)
  }

  // 限制每个角色的动作数量
  const limited: CharacterAction[] = []
  for (const [, charActions] of grouped) {
    limited.push(...charActions.slice(0, maxPerCharacter))
  }

  return limited
}

/**
 * 确定视频风格
 */
function determineVideoStyle(
  scene: ScriptScene,
  actions: CharacterAction[]
): SceneActions['videoStyle'] {
  const actionTypes = actions.map(a => a.actionType)

  // 对话为主
  const dialogueCount = actionTypes.filter(t => t === 'dialogue').length
  if (dialogueCount > actions.length * 0.6) {
    return 'dialogue'
  }

  // 动作/运动为主
  const movementCount = actionTypes.filter(t => t === 'movement').length
  if (movementCount > actions.length * 0.4) {
    return 'action'
  }

  // 检查场景描述是否以风景/环境为主
  if (scene.description.length > 100 &&
      !scene.description.includes('角色') &&
      !scene.description.includes('人物')) {
    return 'landscape'
  }

  return 'mixed'
}

/**
 * 计算建议时长
 */
function calculateSuggestedDuration(
  scene: ScriptScene,
  actions: CharacterAction[]
): number {
  // 基础时长
  let duration = 5

  // 根据动作数量调整
  if (actions.length > 3) {
    duration += 2
  }

  // 根据对话数量调整
  const dialogueCount = actions.filter(a => a.actionType === 'dialogue').length
  if (dialogueCount >= 3) {
    duration += 3
  }

  // 根据场景描述长度调整
  if (scene.description.length > 100) {
    duration += 2
  }

  // 根据场景复杂度调整
  const complexity = scene.characters.length + scene.actions.length
  if (complexity > 5) {
    duration += 2
  }

  // 限制在 4-15 秒范围内
  return Math.min(15, Math.max(4, duration))
}

/**
 * 建议镜头运动
 */
function suggestCameraMovement(
  videoStyle: SceneActions['videoStyle']
): string {
  const suggestions: Record<SceneActions['videoStyle'], string> = {
    'dialogue': 'Medium close-up, subtle push-in on key dialogue',
    'action': 'Dynamic tracking shot, smooth dolly follow',
    'landscape': 'Slow wide pan, aerial crane reveal',
    'mixed': 'Medium shot, gentle tracking movement'
  }

  return suggestions[videoStyle]
}

/**
 * 提取角色在场景中的动作序列
 */
export function extractCharacterActionSequence(
  scene: ScriptScene,
  characterName: string
): CharacterAction[] {
  const allActions = extractActionsFromScene(scene)

  return allActions.actions.filter(
    action => action.characterName === characterName
  )
}

/**
 * 合并多个连续场景的动作（用于长视频）
 */
export function mergeSceneActions(
  sceneActions: SceneActions[]
): CharacterAction[] {
  const merged: CharacterAction[] = []

  for (const sa of sceneActions) {
    merged.push(...sa.actions)
  }

  // 去重
  const seen = new Set<string>()
  const unique: CharacterAction[] = []
  for (const action of merged) {
    const key = `${action.characterName}-${action.actionType}-${action.description.slice(0, 20)}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(action)
    }
  }

  return unique
}
