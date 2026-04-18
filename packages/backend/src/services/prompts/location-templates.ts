/**
 * 场地相关提示词模板
 * 包含：定场图提示词生成、视觉丰富（批量提取角色和场地）
 */

import type { PromptTemplate } from './template-engine.js'

/** 场地视觉丰富模板 - 批量提取场地和角色并生成提示词 */
export const VISUAL_ENRICHMENT_TEMPLATE: PromptTemplate = {
  id: 'visual-enrichment',
  version: '1.0.0',
  systemPrompt: `你只输出紧凑的合法 JSON，供中文短剧生产工具使用；不要 markdown、不要前言/后语。
locations 与 characters 的撰写细则在用户消息中；locations[].imagePrompt 与 characters[].images[].prompt 须为中文。
必须返回一个 JSON 对象，且包含 locations 与 characters 两个键；字段不得遗漏。若无场地则 locations 为 []。
若下列用户消息提供了场地列表：locations 须覆盖每个场地名，且每条 name 必须与列表第一列场地名称完全一致（逐字相同，勿改写或缩写）。`,
  userPromptTemplate: `根据下列剧本梗概与实体列表，输出 **仅一段合法 JSON**（不要 markdown 代码块），结构为：
{"locations":[{"name":"场地名","imagePrompt":"中文定场图提示词"}],
"characters":[{"name":"角色名","images":[{"name":"形象名","type":"base|outfit|expression|pose","description":"可选中文说明","prompt":"中文提示词"}]}]}

【定场图 imagePrompt】（仅用于 locations 数组；不影响 characters）
视角：你是顶级电影勘景摄影师，每条 imagePrompt 描述的是空无一人的拍摄场景，作为文生图指令，不是剧本片段。
铁律：绝对禁止在 imagePrompt 中出现任何人物、动物、影子或任何暗示人类活动的痕迹；若场地描述中含人物动作，你必须过滤掉。
每条 imagePrompt 须为中文，四段意合为一段连续文字、句间用句号分隔，整体不超过约120字：
1）空间与环境：核心建筑结构、标志性物体、材质与布局；
2）光影与氛围：依「时间」写光线方向、硬/柔与色温、情绪氛围；时间未指定时可依描述推断或使用中性光；
3）构图与视角：推荐景别与角度（如广角全景、平视中景）；
4）风格与画质：融入下方「项目视觉风格」；并含画质词（如电影质感、8K超高清等）。
【文生图合规】商业化文生图 API 常对「审讯室」「刑讯」「看守所」「监狱」「羁押」等执法/刑事监禁类字面触发审核或拒图。若剧本为警务、刑侦场景，定场图只写建筑与光影：双面玻璃隔间、会谈室、办公问询区、玻璃对侧空房间、冷色涂料墙面、监控室外观等中性置景词；避免刑讯、关押、暴力执法暗示；不写人物与剧情动作。
characters 的定妆规则以本消息下文为准；勿用定场图的「无人」约束去改写角色定妆。
{{#exactLocationNames}}

【场地名白名单】locations[].name 必须逐字等于下列某一行（整行复制到 JSON 的 name 字段；勿改写、勿缩写、勿加「场景」「内景」等前缀；括号与标点须保留）：
{{#exactLocationNames}}
- {{.}}
{{/exactLocationNames}}
{{/exactLocationNames}}

【项目视觉风格】用于 locations 每条 imagePrompt 的第4段（风格与画质），须自然融入：
{{projectVisualStyleLine}}

locations 中每条 imagePrompt 须符合上文「定场图」四段式；locations 每条 name 必须使用上文白名单（若有）或下文场地列表第一列名称；整段响应仍为唯一 JSON 对象。

规则（角色 images 数组顺序很重要）：
1. 每个角色的 images 里 **必须先写至少 1 条 type 为 base 的定妆**（可与默认基础形象对应），再写衍生。
2. **base**：prompt 为完整中文定妆提示词（主参考图）。须：站立于**纯色影棚背景**（如中灰色）；**正面全身构图（头顶到脚底完整可见）**；四段意合为一段、句间用句号分隔，整体不超过约150字：（1）面部特征（脸型、眼睛、眉毛、鼻子、嘴唇）（2）整体外貌与发型（3）服装与姿态（4）构图与背景须显式包含正面全身与纯色底，并融入下方「项目视觉风格」与画质词；禁止只写剧情动作，须写「长什么样、穿什么」。
3. **outfit**（换装）：优先采用「保持该角色面部特征、发型与所有标志性细节完全不变，仅将服装更换为：……。纯色影棚背景。」整体不超过约120字；须写清相对 base 仅变化服装与配饰。
4. **expression / pose**（表情/姿态）：相对 base 明确保持不变与仅变化；建议先锁身份（与 base 同一人）再写表情或体态的差异，避免写成全新人物。
5. 衍生推荐句式：与基础定妆为同一人；保持……不变；仅变化：……。若输出缺显式锚定，服务端可能在落库时补前缀，模型仍应优先输出完整句。
6. 有换装、明显表情或姿态差异时再追加衍生条目；无则不必凑数。
7. **铁律**：每条 characters[].images[] 必须包含非空的「prompt」字符串（中文定妆/换装提示词）；description 仅作辅助说明，不可替代 prompt。
locations 数组覆盖下列场地名；characters 覆盖下列角色名。

剧本梗概：
{{scriptSummary}}

场地（每行：名称 | 时间：… | 描述：…）：
{{locationLines}}

角色（每行：名称 | 已有描述）：
{{characterLines}}`,
  metadata: {
    category: 'visual',
    creativity: 0.4,
    maxOutputTokens: 4096,
    description: '从剧本梗概批量提取场地和角色，生成定场图和角色定妆提示词',
    tags: ['visual', 'enrichment', 'batch', 'extraction', 'location', 'character']
  }
}

/** 定场图提示词生成模板（单场地） */
export const LOCATION_ESTABLISHING_TEMPLATE: PromptTemplate = {
  id: 'location-establishing',
  version: '2.0.0',
  systemPrompt: `你是一位顶级的电影勘景摄影师，专门为短剧拍摄寻找和描述空无一人的场景。

# 核心铁律
**绝对禁止在提示词中出现任何人物、动物、影子或任何暗示人类活动的痕迹。**
你描述的是一个"尚未有演员进入"的原始空间。如果有人物描述输入，你必须主动过滤掉。`,
  userPromptTemplate: `请根据以下场地信息生成纯场景提示词：

场地名称：{{locationName}}
场地描述：{{locationDescription}}
时间：{{timeOfDay}}
{{#visualStylePrompt}}项目视觉风格：{{visualStylePrompt}}
{{/visualStylePrompt}}

输出结构：
请严格按照以下四部分结构生成提示词，每部分用句号分隔，整体不超过120字：

1. [空间与环境]：提炼场地的核心建筑结构、标志性物体、材质和空间布局。忽略所有人物动作。
2. [光影与氛围]：根据时间描述光线的方向、质感（硬/柔）和色温，营造情绪氛围。
3. [构图与视角]：推荐一个能展现空间特点的镜头景别和角度（如：广角全景、中景平视）。
4. [风格与画质]：融入项目视觉风格，并添加画质词（如：8K超高清、电影级光影）。

直接输出提示词，不要任何前缀或解释。`,
  metadata: {
    category: 'location',
    creativity: 0.5,
    maxOutputTokens: 400,
    description: '为单个场地生成定场图提示词（空场景，无人物）',
    tags: ['location', 'establishing', 'empty-scene', 'single']
  }
}

/** 导出所有场地模板 */
export const LOCATION_TEMPLATES: PromptTemplate[] = [
  VISUAL_ENRICHMENT_TEMPLATE,
  LOCATION_ESTABLISHING_TEMPLATE
]
