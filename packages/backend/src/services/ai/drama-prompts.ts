/**
 * 短剧专用 AI Prompt 生成服务
 * 为续写、润色、钩子生成等提供专业化 Prompt 模板
 */

export interface DramaPromptContext {
  content: string
  protagonistName?: string
  characters?: Array<{ name: string; personality?: string; relationship?: string }>
  episodeHook?: string
  episodeCliffhanger?: string
  templateName?: string
}

export type DramaCommand = 'continue' | 'polish' | 'hook' | 'conflict' | 'ad'

function buildCharacterCard(characters: DramaPromptContext['characters']): string {
  if (!characters || characters.length === 0) return ''
  const lines = characters.map((c) => {
    const parts = [`- ${c.name}`]
    if (c.personality) parts.push(`  性格：${c.personality}`)
    if (c.relationship) parts.push(`  关系：${c.relationship}`)
    return parts.join('\n')
  })
  return `角色卡：\n${lines.join('\n')}\n`
}

export function buildContinuePrompt(ctx: DramaPromptContext): string {
  const characterCard = buildCharacterCard(ctx.characters)
  const hookConstraint = ctx.episodeHook ? `本集开头钩子：${ctx.episodeHook}\n` : ''
  const cliffhangerConstraint = ctx.episodeCliffhanger
    ? `本集结尾悬念要求：${ctx.episodeCliffhanger}\n`
    : ''

  return `你是一位资深短剧编剧，擅长写"一句一顶撞、一段一转折"的强冲突对白。

${characterCard}${hookConstraint}${cliffhangerConstraint}当前已写内容：
---
${ctx.content}
---

请根据以上内容续写短剧剧本，要求：
1. 保持短剧语感：一句一顶撞、一段一转折
2. 情绪词强化：用"怒斥"代替"说"，用"冷笑"代替"回答"，用"嘶吼"代替"喊"
3. 每段对白不超过3句，节奏要快
4. 必须保持角色人设一致（参考角色卡）
5. 续写内容要自然衔接上文，不要重复已有内容
6. 如果接近结尾，要为"结尾悬念"做铺垫

只输出续写的剧本内容，不要解释。`
}

export function buildPolishPrompt(ctx: DramaPromptContext): string {
  const characterCard = buildCharacterCard(ctx.characters)

  return `你是一位短剧润色专家，专门把平淡的叙述改成有网感的对白。

${characterCard}待润色内容：
---
${ctx.content}
---

请润色以上内容，要求：
1. 将叙述性文字改为对白（减少"他心想""她看着"等叙述）
2. 情绪词替换：
   - "说" → "怒斥/冷笑/低吼/咬牙道/厉声道"
   - "回答" → "反驳/回怼/嗤笑/冷冷道"
   - "问" → "质问/逼问/厉声问"
   - "看" → "瞪/瞥/扫视/死死盯着"
3. 压缩冗余，保留核心冲突
4. 增加网感：适当使用"你也配？""找死！""给我等着"等短剧高频台词
5. 保持原意不变，只改表达方式

只输出润色后的剧本内容，不要解释。`
}

export function buildHookPrompt(ctx: DramaPromptContext): string {
  return `你是一位短剧钩子设计专家，擅长设计让观众"忍不住点下一集"的结尾悬念。

当前集已写内容：
---
${ctx.content}
---

请根据以上内容，生成3个不同类型的结尾钩子方案：

要求：
1. 方案一（身份悬念型）：涉及身份、秘密、真相即将揭露
2. 方案二（威胁升级型）：新威胁出现，主角陷入更大危机
3. 方案三（情感冲击型）：情感关系突变，误会/背叛/告白

每个方案包含：
- 钩子内容（1-2句话，直接可用）
- 类型标签
- 付费转化潜力评分（1-10分，10分最强）
- 适用场景说明

输出格式：
方案一 [身份悬念]（转化潜力：X/10）
内容：...
适用：...

方案二 [威胁升级]（转化潜力：X/10）
内容：...
适用：...

方案三 [情感冲击]（转化潜力：X/10）
内容：...
适用：...`
}

export function buildConflictPrompt(ctx: DramaPromptContext): string {
  const characterCard = buildCharacterCard(ctx.characters)

  return `你是一位短剧冲突设计专家，擅长把平淡对白改成"对抗式对白"。

${characterCard}待强化内容：
---
${ctx.content}
---

请将以上内容中的平淡段落改为对抗式对白，遵循以下模式：
A质疑 → B反驳 → A威胁 → B反击

要求：
1. 识别平淡的叙述性段落，改为角色间的直接对抗
2. 每轮对抗至少3个回合（A→B→A→B）
3. 情绪逐层升级：从质疑到愤怒到威胁
4. 保持角色人设不崩（参考角色卡）
5. 保留原剧情的核心信息，只改表达方式

对抗式对白示例：
- 平淡："你怎么能这样对我？"她说。
- 对抗："你也配提对得起三个字？"她冷笑，眼底淬着冰，"这三年来，你花着我家的钱，住着我家的房，现在跟我谈感情？"

只输出强化后的剧本内容，不要解释。`
}

export function buildAdCopyPrompt(ctx: DramaPromptContext): string {
  return `你是一位短剧投流文案专家，擅长从剧本中提取"高光10秒"并生成爆款广告文案。

剧本内容：
---
${ctx.content}
---

请完成以下任务：

1. 提取"高光10秒"：从剧本中找出最具冲击力的1个片段（身份揭露/打脸/反转/情感爆发），用3句话描述

2. 生成5条不同风格的投流广告文案：
   - 风格一：悬念型（"你永远想不到...""原来他才是..."）
   - 风格二：冲突型（"当面羞辱→身份揭露→全场震惊"）
   - 风格三：情感型（"三年的付出，换来的却是..."）
   - 风格四：爽点型（"废物女婿？不，他是..."）
   - 风格五：反转型（"所有人都以为他完了，直到..."）

3. 每条文案标注：
   - 情绪钩子（吸引点击的核心情绪）
   - 建议投放平台（抖音/快手/微信视频号）
   - 预估CTR等级（高/中/低）

输出格式清晰，每条文案控制在30字以内。`
}

export function buildDramaPrompt(command: DramaCommand, ctx: DramaPromptContext): string {
  switch (command) {
    case 'continue':
      return buildContinuePrompt(ctx)
    case 'polish':
      return buildPolishPrompt(ctx)
    case 'hook':
      return buildHookPrompt(ctx)
    case 'conflict':
      return buildConflictPrompt(ctx)
    case 'ad':
      return buildAdCopyPrompt(ctx)
    default:
      return ctx.content
  }
}
