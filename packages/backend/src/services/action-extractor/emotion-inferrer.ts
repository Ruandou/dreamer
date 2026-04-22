/**
 * 情绪推断工具函数
 * 从对话和动作中提取情绪信息
 */

/** 情绪关键词映射表 */
const EMOTION_KEYWORDS: [string, string][] = [
  ['颤抖', '紧张'],
  ['tremble', 'nervous'],
  ['流泪', '悲伤'],
  ['cry', 'sad'],
  ['微笑', '开心'],
  ['smile', 'happy'],
  ['大笑', '欢乐'],
  ['laugh', 'joy'],
  ['皱眉', '忧虑'],
  ['frown', 'worried'],
  ['抬头', '坚定'],
  ['look up', 'determined'],
  ['低头', '沮丧'],
  ['head down', 'depressed'],
  ['握拳', '愤怒'],
  ['clench', 'angry'],
  ['拥抱', '亲密'],
  ['hug', 'intimate'],
  ['挥手', '告别'],
  ['wave', 'goodbye']
]

/**
 * 从对话中推断情绪
 */
export function inferEmotionFromDialogue(dialogue: string): string {
  const lowerText = dialogue.toLowerCase()

  // 强烈情绪词
  if (
    lowerText.includes('!') ||
    lowerText.includes('！') ||
    lowerText.includes('震惊') ||
    lowerText.includes('惊讶')
  ) {
    return '震惊'
  }

  if (
    lowerText.includes('哭') ||
    lowerText.includes('泪') ||
    lowerText.includes('cry') ||
    lowerText.includes('tear')
  ) {
    return '悲伤'
  }

  if (
    lowerText.includes('笑') ||
    lowerText.includes('开心') ||
    lowerText.includes('happy') ||
    lowerText.includes('joy')
  ) {
    return '开心'
  }

  if (lowerText.includes('怒') || lowerText.includes('气愤') || lowerText.includes('angry')) {
    return '愤怒'
  }

  if (lowerText.includes('爱') || lowerText.includes('喜欢') || lowerText.includes('love')) {
    return '爱慕'
  }

  return '平静'
}

/**
 * 从动作文本中推断情绪
 */
export function inferEmotionFromAction(actionText: string): string {
  const lowerText = actionText.toLowerCase()

  for (const [keyword, emotion] of EMOTION_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return emotion
    }
  }

  return '中性'
}
