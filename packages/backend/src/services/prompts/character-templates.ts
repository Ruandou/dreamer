/**
 * 角色相关提示词模板
 * 包含：基础定妆、换装、表情、姿态等形象槽位提示词生成
 */

import type { PromptTemplate } from './template-engine.js'

/** 基础定妆提示词模板 */
export const CHARACTER_BASE_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'character-base-prompt',
  version: '2.0.0',
  systemPrompt:
    '你是短剧角色基础定妆提示词撰写助手。只输出中文提示词正文；须纯色影棚背景、正面全身构图（头顶到脚底）、锚定面部特征与发型与基础服装，句间用句号；除专有名词外不要使用英文。必须严格保持角色设定中的性别与年龄感，18岁角色须呈现为年轻成人而非儿童。若角色设定暗示女性（如母亲、妻子、姐妹、女性名字等），必须生成女性形象；若暗示男性，必须生成男性形象。',
  userPromptTemplate: `角色名：{{characterName}}
{{#characterDescription}}角色设定：{{characterDescription}}
{{/characterDescription}}
形象槽位名称：{{slotName}}
槽位类型：base（基础定妆）
{{#visualStylePrompt}}
项目视觉风格：{{visualStylePrompt}}
{{/visualStylePrompt}}

【基础定妆】站立于纯色影棚背景（如中灰色）；正面全身构图（头顶到脚底完整可见）；四段意合为一段：（1）面部特征（脸型、眼睛、眉毛、鼻子、嘴唇）与年龄感（严格按角色设定中的年龄呈现）（2）整体外貌与发型（3）服装与姿态（4）构图与背景须点明正面全身与纯色底，并融入项目视觉风格与画质词；整体不超过约150字。
禁止只写剧情动作，须写「长什么样、穿什么」。年龄感必须与角色设定完全一致，不可偏差。

请输出一条中文的 AI 绘画提示词（写实或半写实风格、短剧角色定妆），只输出提示词正文，不要引号或解释。`,
  metadata: {
    category: 'character',
    creativity: 0.6,
    maxOutputTokens: 400,
    description: '生成角色基础定妆图提示词（七分身、纯色背景）',
    tags: ['character', 'base', 'portrait', 'reference']
  }
}

/** 换装提示词模板 */
export const CHARACTER_OUTFIT_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'character-outfit-prompt',
  version: '2.0.0',
  systemPrompt:
    '你是短剧角色换装提示词撰写助手。只输出中文提示词正文；必须强调面部特征、发型与标志性细节完全不变，仅更换服装与配饰；纯色影棚背景；除专有名词外不要使用英文。必须严格保持角色设定中的性别，若角色设定暗示女性则必须为女性形象，若暗示男性则必须为男性形象。',
  userPromptTemplate: `角色名：{{characterName}}
{{#characterDescription}}角色设定：{{characterDescription}}
{{/characterDescription}}
形象槽位名称：{{slotName}}
槽位类型：outfit（换装）
{{#slotDescription}}槽位说明：{{slotDescription}}
{{/slotDescription}}{{#parentSlotSummary}}

父级基础形象参考：{{parentSlotSummary}}
{{/parentSlotSummary}}{{#visualStylePrompt}}

项目视觉风格：{{visualStylePrompt}}
{{/visualStylePrompt}}

【换装】采用：保持该角色面部特征、发型与标志性细节完全不变，仅将服装更换为：……（结合槽位说明）。纯色影棚背景。整体不超过约120字。
若已提供父级基础形象参考，须与之为同一人，勿写成新角色。

请输出一条中文的 AI 绘画提示词（写实或半写实风格、角色换装定妆），只输出提示词正文，不要引号或解释。`,
  metadata: {
    category: 'character',
    creativity: 0.6,
    maxOutputTokens: 400,
    description: '生成角色换装图提示词（保持面部一致，仅变化服装）',
    tags: ['character', 'outfit', 'costume', 'derivative']
  }
}

/** 表情/姿态提示词模板 */
export const CHARACTER_EXPRESSION_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'character-expression-prompt',
  version: '1.0.0',
  systemPrompt:
    '你是短剧角色定妆提示词撰写助手。只输出中文提示词正文；相对父级基础形象保持人物身份一致，描述表情或体态等「仅变化」部分；除专有名词外不要使用英文。必须严格保持角色设定中的性别，若角色设定暗示女性则必须为女性形象，若暗示男性则必须为男性形象。',
  userPromptTemplate: `角色名：{{characterName}}
{{#characterDescription}}角色设定：{{characterDescription}}
{{/characterDescription}}
形象槽位名称：{{slotName}}
槽位类型：{{slotType}}（表情或姿态）
{{#slotDescription}}槽位说明：{{slotDescription}}
{{/slotDescription}}{{#parentSlotSummary}}

父级基础形象参考：{{parentSlotSummary}}
{{/parentSlotSummary}}

【衍生形象】相对父级基础形象保持身份一致；中文写清仅变化部分（表情或姿态等），背景以纯色或简单棚拍为宜。

请输出一条中文的 AI 绘画提示词（写实或半写实风格、角色表情或姿态定妆），只输出提示词正文，不要引号或解释。`,
  metadata: {
    category: 'character',
    creativity: 0.6,
    maxOutputTokens: 400,
    description: '生成角色表情或姿态图提示词（保持身份一致）',
    tags: ['character', 'expression', 'pose', 'derivative']
  }
}

/** 导出所有角色模板 */
export const CHARACTER_TEMPLATES: PromptTemplate[] = [
  CHARACTER_BASE_PROMPT_TEMPLATE,
  CHARACTER_OUTFIT_PROMPT_TEMPLATE,
  CHARACTER_EXPRESSION_PROMPT_TEMPLATE
]
