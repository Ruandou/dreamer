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
    '你是短剧角色基础定妆提示词撰写助手。只输出中文提示词正文；须纯色影棚背景、正面全身构图（头顶到脚底）、锚定面部特征与发型与基础服装，句间用句号；除专有名词外不要使用英文。每条输出必须以「性别+年龄」词组开头，明确标示角色身份，例如「青年男性」「中年女性」「年轻女性」等，从角色设定中严格提取，不可省略。必须严格保持角色设定中的性别与年龄感，18岁角色须呈现为年轻成人而非儿童。若角色设定暗示女性（如母亲、妻子、姐妹、女性名字等），必须生成女性形象；若暗示男性，必须生成男性形象。若项目为中国历史题材（古装/仙侠/武侠/民国等），角色必须为东亚人外貌（黑发黑眼、黄皮肤、东亚五官轮廓），禁止生成欧美人、混血或西方面孔；服装、发型、配饰须严格贴合时代背景，不可出现时代错位的现代元素。设计原创虚构的面部特征，避免与任何现实人物或公众人物相似；五官组合须有独特辨识度，禁止使用常见明星特征或千篇一律的网红模板。',
  userPromptTemplate: `角色名：{{characterName}}
{{#characterDescription}}角色设定：{{characterDescription}}
{{/characterDescription}}
形象槽位名称：{{slotName}}
槽位类型：base（基础定妆）
{{#visualStylePrompt}}
项目视觉风格：{{visualStylePrompt}}
{{/visualStylePrompt}}

【基础定妆】站立于纯色影棚背景（如中灰色）；正面全身构图（头顶到脚底完整可见）；四段意合为一段、句间用句号分隔，整体不超过约150字：
（1）性别与年龄（必须以「男性」或「女性」开头，后接年龄如「青年」「中年」「老年」或具体岁数，从角色设定中严格提取，不可省略），然后面部特征：须从下列参考词中选择具体组合，使每个角色有独特辨识度——脸型{瓜子脸/方脸/圆脸/长脸/心形脸/鹅蛋脸/菱形脸}、眼睛{杏仁眼/桃花眼/丹凤眼/圆眼/细长眼/狐狸眼}、眉毛{剑眉/柳叶眉/平眉/拱眉/浓眉/淡眉}、鼻子{高挺鼻/圆鼻头/鹰钩鼻/小翘鼻/直鼻/蒜头鼻}、嘴唇{薄唇/厚唇/M字唇/微笑唇/樱桃小嘴}，可附加特殊标记{泪痣/眉心痣/酒窝/疤痕}；
（2）整体外貌与发型：体型{纤瘦/匀称/健壮/丰满}、肩型{宽肩/窄肩/平肩/溜肩}、发型{长发及腰/短发利落/双鬟/高髻/披发/束发}、发色{黑色/棕色}；
（3）服装与姿态：须贴合角色设定时代与身份，写明款式、颜色、材质；
（4）构图与背景须点明正面全身与纯色底，并融入项目视觉风格与画质词。
禁止只写剧情动作，须写「长什么样、穿什么」。性别、年龄与年龄感必须与角色设定完全一致，不可偏差。

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
    '你是短剧角色换装提示词撰写助手。只输出中文提示词正文；每条输出必须以「性别+年龄」词组开头，明确标示角色身份；必须强调面部特征、发型与标志性细节完全不变，仅更换服装与配饰；纯色影棚背景；除专有名词外不要使用英文。必须严格保持角色设定中的性别，若角色设定暗示女性则必须为女性形象，若暗示男性则必须为男性形象。若项目为中国历史题材（古装/仙侠/武侠/民国等），角色必须为东亚人外貌（黑发黑眼、黄皮肤、东亚五官轮廓），禁止生成欧美人、混血或西方面孔；换装须严格贴合时代背景，不可出现时代错位的现代元素。保持原创虚构的面部特征，避免与任何现实人物或公众人物相似。',
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

【换装】采用：保持该角色面部特征、发型与所有标志性细节完全不变，仅将服装更换为：……（结合槽位说明）。
服装描写公式：颜色 + 材质 + 纹样 + 款式 + 配饰。须贴合角色设定时代与身份，从下列参考词中选择——
- 朝代款式：深衣/襦裙/曲裾/直裰/圆领袍/道袍/袄裙/马面裙/劲装/鹤氅/留仙裙/大袖衫/中山装/旗袍/长衫
- 材质：灵蚕纱/天霞锦/云雾纱/丝绸/锦缎/绫/罗/绸/缎/锦/粗布/麻衣/棉/绢
- 颜色：月白/朱砂/玄色/藕荷/黛色/紫金/青/白/黑/红/黄/绿/紫/金/银/棕/褐
- 纹样：流云暗纹/八卦图/折枝花/龙凤纹/祥云纹/宝相花/联珠纹/团花/鸟兽/太极/莲花
- 配饰：玉冠/步摇/簪/钗/花钿/华胜/珠花/丝绦/玉佩/储物袋/荷包/葫芦/剑穗/拂尘/折扇/八卦镜
示例：月白色灵蚕纱道袍，衣摆绣银色流云暗纹，交领右衽，宽袖长摆，腰间系青色丝绦悬挂长剑。
纯色影棚背景。整体不超过约120字。
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
    '你是短剧角色定妆提示词撰写助手。只输出中文提示词正文；每条输出必须以「性别+年龄」词组开头；相对父级基础形象保持人物身份一致，描述表情或体态等「仅变化」部分；除专有名词外不要使用英文。必须严格保持角色设定中的性别，若角色设定暗示女性则必须为女性形象，若暗示男性则必须为男性形象。若项目为中国历史题材（古装/仙侠/武侠/民国等），角色必须为东亚人外貌（黑发黑眼、黄皮肤、东亚五官轮廓），禁止生成欧美人、混血或西方面孔。保持原创虚构的面部特征，避免与任何现实人物或公众人物相似。',
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
