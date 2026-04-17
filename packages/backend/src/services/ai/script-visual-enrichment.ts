import type { ModelCallLogContext } from './api-logger.js'
import { getDeepSeekClient, type DeepSeekCost } from './deepseek-client.js'
import {
  DEEPSEEK_TEMPERATURE,
  DEEPSEEK_MAX_TOKENS
} from './ai.constants.js'
import {
  callDeepSeekWithRetry,
  cleanMarkdownCodeBlocks,
  type DeepSeekCallOptions
} from './deepseek-call-wrapper.js'

/** system 过长时模型容易输出非严格 JSON，长规则放在用户消息中 */
export const SCRIPT_VISUAL_ENRICH_SYSTEM_PROMPT = [
  '你只输出紧凑的合法 JSON，供中文短剧生产工具使用；不要 markdown、不要前言/后语。',
  'locations 与 characters 的撰写细则在用户消息中；locations[].imagePrompt 与 characters[].images[].prompt 须为中文。',
  '必须返回一个 JSON 对象，且包含 locations 与 characters 两个键；字段不得遗漏。若无场地则 locations 为 []。',
  '若下列用户消息提供了场地列表：locations 须覆盖每个场地名，且每条 name 必须与列表第一列场地名称完全一致（逐字相同，勿改写或缩写）。'
].join('\n')

/** 写入用户消息，与 buildScriptVisualEnrichmentUserContent 同步 */
export const SCRIPT_VISUAL_ENRICH_LOCATION_RULES_IN_USER = [
  '【定场图 imagePrompt】（仅用于 locations 数组；不影响 characters）',
  '视角：你是顶级电影勘景摄影师，每条 imagePrompt 描述的是空无一人的拍摄场景，作为文生图指令，不是剧本片段。',
  '铁律：绝对禁止在 imagePrompt 中出现任何人物、动物、影子或任何暗示人类活动的痕迹；若场地描述中含人物动作，你必须过滤掉。',
  '每条 imagePrompt 须为中文，四段意合为一段连续文字、句间用句号分隔，整体不超过约120字：',
  '1）空间与环境：核心建筑结构、标志性物体、材质与布局；',
  '2）光影与氛围：依「时间」写光线方向、硬/柔与色温、情绪氛围；时间未指定时可依描述推断或使用中性光；',
  '3）构图与视角：推荐景别与角度（如广角全景、平视中景）；',
  '4）风格与画质：融入下方「项目视觉风格」；并含画质词（如电影质感、8K超高清等）。',
  '【文生图合规】商业化文生图 API 常对「审讯室」「刑讯」「看守所」「监狱」「羁押」等执法/刑事监禁类字面触发审核或拒图。若剧本为警务、刑侦场景，定场图只写建筑与光影：双面玻璃隔间、会谈室、办公问询区、玻璃对侧空房间、冷色涂料墙面、监控室外观等中性置景词；避免刑讯、关押、暴力执法暗示；不写人物与剧情动作。',
  'characters 的定妆规则以本消息下文为准；勿用定场图的「无人」约束去改写角色定妆。'
].join('\n')

export function buildScriptVisualEnrichmentUserContent(input: {
  scriptSummary: string
  locationLines: string
  characterLines: string
  projectVisualStyleLine: string
  /** 与库内 Location.name 完全一致的可复制列表，减少模型改写场地名导致无法落库 */
  exactLocationNames?: string[]
}): string {
  const style = input.projectVisualStyleLine.trim() || '（未指定）'
  const names = input.exactLocationNames?.filter(Boolean) ?? []
  const locationNameBlock =
    names.length > 0
      ? [
          '【场地名白名单】locations[].name 必须逐字等于下列某一行（整行复制到 JSON 的 name 字段；勿改写、勿缩写、勿加「场景」「内景」等前缀；括号与标点须保留）：',
          ...names.map((n) => `- ${n.replace(/\s+/g, ' ').trim()}`),
          ''
        ]
      : []
  return [
    '根据下列剧本梗概与实体列表，输出 **仅一段合法 JSON**（不要 markdown 代码块），结构为：',
    '{"locations":[{"name":"场地名","imagePrompt":"中文定场图提示词"}],',
    '"characters":[{"name":"角色名","images":[{"name":"形象名","type":"base|outfit|expression|pose","description":"可选中文说明","prompt":"中文提示词"}]}]}',
    '',
    SCRIPT_VISUAL_ENRICH_LOCATION_RULES_IN_USER,
    '',
    ...locationNameBlock,
    '【项目视觉风格】用于 locations 每条 imagePrompt 的第4段（风格与画质），须自然融入：',
    style,
    '',
    'locations 中每条 imagePrompt 须符合上文「定场图」四段式；locations 每条 name 必须使用上文白名单（若有）或下文场地列表第一列名称；整段响应仍为唯一 JSON 对象。',
    '',
    '规则（角色 images 数组顺序很重要）：',
    '1. 每个角色的 images 里 **必须先写至少 1 条 type 为 base 的定妆**（可与默认基础形象对应），再写衍生。',
    '2. **base**：prompt 为完整中文定妆提示词（主参考图）。须：站立于**纯色影棚背景**（如中灰色）；**七分身构图（膝盖以上）**；四段意合为一段、句间用句号分隔，整体不超过约120字：（1）主体与外貌（2）发型与标志（3）服装与姿态（4）构图与背景须显式包含七分身与纯色底，并融入下方「项目视觉风格」与画质词；禁止只写剧情动作，须写「长什么样、穿什么」。',
    '3. **outfit**（换装）：优先采用「保持该角色面部特征、发型与所有标志性细节完全不变，仅将服装更换为：……。纯色影棚背景。」整体不超过约100字；须写清相对 base 仅变化服装与配饰。',
    '4. **expression / pose**（表情/姿态）：相对 base 明确保持不变与仅变化；建议先锁身份（与 base 同一人）再写表情或体态的差异，避免写成全新人物。',
    '5. 衍生推荐句式：与基础定妆为同一人；保持……不变；仅变化：……。若输出缺显式锚定，服务端可能在落库时补前缀，模型仍应优先输出完整句。',
    '6. 有换装、明显表情或姿态差异时再追加衍生条目；无则不必凑数。',
    '7. **铁律**：每条 characters[].images[] 必须包含非空的「prompt」字符串（中文定妆/换装提示词）；description 仅作辅助说明，不可替代 prompt。',
    'locations 数组覆盖下列场地名；characters 覆盖下列角色名。',
    '',
    `剧本梗概：\n${input.scriptSummary.slice(0, 8000)}`,
    '',
    `场地（每行：名称 | 时间：… | 描述：…）：\n${input.locationLines || '(无)'}`,
    '',
    `角色（每行：名称 | 已有描述）：\n${input.characterLines || '(无)'}`
  ].join('\n')
}

export async function fetchScriptVisualEnrichmentJson(
  input: {
    scriptSummary: string
    locationLines: string
    characterLines: string
    /** 项目视觉风格（顿号连接），供定场图第4段融入 */
    projectVisualStyleLine?: string
    /** 当前项目场地库名称，供白名单约束，降低模型改写名导致 imagePrompt 不落库 */
    exactLocationNames?: string[]
  },
  log?: ModelCallLogContext
): Promise<{ jsonText: string; cost: DeepSeekCost }> {
  const projectVisualStyleLine = (input.projectVisualStyleLine || '').trim() || '（未指定）'
  const user = buildScriptVisualEnrichmentUserContent({ ...input, projectVisualStyleLine })
  const deepseek = getDeepSeekClient()

  // Parser function for the wrapper
  const parseJsonText = (content: string): string => {
    const cleaned = cleanMarkdownCodeBlocks(content)
    return cleaned.trim()
  }

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: SCRIPT_VISUAL_ENRICH_SYSTEM_PROMPT,
    userPrompt: user,
    temperature: DEEPSEEK_TEMPERATURE.VISUAL_ENRICH,
    maxTokens: DEEPSEEK_MAX_TOKENS.VISUAL_ENRICH,
    modelLog: log
  }

  const result = await callDeepSeekWithRetry(options, parseJsonText)

  return {
    jsonText: result.content,
    cost: result.cost
  }
}
