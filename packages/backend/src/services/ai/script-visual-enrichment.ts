import type { ModelCallLogContext } from './api-logger.js'
import type { DeepSeekCost } from './deepseek-client.js'
import {
  callLLMWithRetry,
  cleanMarkdownCodeBlocks,
  type LLMCallOptions
} from './llm-call-wrapper.js'
import { type LLMProvider } from './llm-factory.js'
import { PromptRegistry } from '../prompts/registry.js'
import type { LLMMessage } from './llm-provider.js'
import type { VisualStyleConfig } from '@dreamer/shared'
import { buildVisualStylePrompt } from '../prompts/visual-style-builder.js'

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
  '每条 imagePrompt 须为中文，四段意合为一段连续文字、句间用句号分隔，整体不超过约150字：',
  '1）空间与环境：核心建筑结构、标志性物体、材质与布局；须按前景/中景/背景分层描写，增强空间纵深感；',
  '2）光影与氛围：依「时间」写光线方向、硬/柔与色温、情绪氛围；时间未指定时可依描述推断或使用中性光；',
  '3）构图与视角：推荐景别与角度（如广角全景、平视中景），可加入引导线或对称构图；',
  '4）风格与画质：融入下方「项目视觉风格」；并含画质词（如电影质感、8K超高清等）。',
  '【场景分类速查】根据场地类型选择对应描写方式：',
  '- 现代室内：咖啡厅{吧台/沙发/吊灯/暖光/窗光/温馨}、办公室{办公桌/电脑/文件柜/中性光/顶灯/专业}、卧室{床/床头灯/窗帘/柔光/暖光/舒适}',
  '- 古代室内：书房{画案/书架/文房四宝/木格窗/晨光/窗光/清雅}、客栈{八仙桌/柜台/楼梯/酒旗/烛光/火把/江湖}、宫殿{蟠龙柱/宝座/汉白玉/金砖/顶光/明暗对照/庄严}、园林{假山/池塘/回廊/亭子/月亮门/散射光/雅致}',
  '- 仙侠场景：仙山主峰{悬浮山峰/云海/凌霄殿/灵瀑/仙鹤/霞光/缥缈}、炼丹房{八卦丹炉/灵药柜/炼丹阵法/三昧真火/丹火光/神秘}、试剑台{剑冢/剑碑/剑气光柱/悬崖/阳光/凌厉}',
  '【材质参考】现代{砖墙/木地板/大理石/玻璃/金属}、古代{青砖墙/白灰墙/青石板/金砖/硬木家具/雕花木窗}、仙侠{白玉/灵木/仙石/琉璃/玄铁/灵玉/云雾/阵法纹路}',
  '【光线参考】自然光{顺光/侧光/逆光/顶光/窗光/晨光/黄昏光/月光}、古代人工{蜡烛/油灯/灯笼/火把/香炉}、仙侠光{灵光/仙火/月华/霞光/荧光/天光/剑光}',
  '【文生图合规】商业化文生图 API 常对「审讯室」「刑讯」「看守所」「监狱」「羁押」等执法/刑事监禁类字面触发审核或拒图。若剧本为警务、刑侦场景，定场图只写建筑与光影：双面玻璃隔间、会谈室、办公问询区、玻璃对侧空房间、冷色涂料墙面、监控室外观等中性置景词；避免刑讯、关押、暴力执法暗示；不写人物与剧情动作。',
  'characters 的定妆规则以本消息下文为准；勿用定场图的「无人」约束去改写角色定妆。'
].join('\n')

export function buildScriptVisualEnrichmentUserContent(input: {
  scriptSummary: string
  locationLines: string
  characterLines: string
  projectVisualStyleLine?: string
  visualStyleConfig?: VisualStyleConfig | null
  /** 与库内 Location.name 完全一致的可复制列表，减少模型改写场地名导致无法落库 */
  exactLocationNames?: string[]
}): string {
  // 优先使用 visualStyleConfig，否则使用旧的 projectVisualStyleLine
  const stylePrompt = input.visualStyleConfig
    ? buildVisualStylePrompt(input.visualStyleConfig)
    : input.projectVisualStyleLine?.trim() || '（未指定）'

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
    '【项目视觉风格】用于 locations 每条 imagePrompt 的第4段（风格与画质）和 characters 定妆，须自然融入：',
    stylePrompt,
    '',
    'locations 中每条 imagePrompt 须符合上文「定场图」四段式；locations 每条 name 必须使用上文白名单（若有）或下文场地列表第一列名称；整段响应仍为唯一 JSON 对象。',
    '',
    '规则（角色 images 数组顺序很重要）：',
    '1. 每个角色的 images 里 **必须先写至少 1 条 type 为 base 的定妆**（可与默认基础形象对应），再写衍生。',
    '2. **base**：prompt 为完整中文定妆提示词（主参考图）。须：站立于**纯色影棚背景**（如中灰色）；**正面全身构图（头顶到脚底完整可见）**；四段意合为一段、句间用句号分隔，整体不超过约150字：',
    '   （1）**性别与年龄**：必须以「男性」或「女性」开头，后接年龄描述如「青年」「中年」「老年」或具体岁数，从角色设定中严格提取，不可省略；',
    '   （2）面部特征：须从下列参考词中选择具体组合，使每个角色有独特辨识度——脸型{瓜子脸/方脸/圆脸/长脸/心形脸/鹅蛋脸/菱形脸}、眼睛{杏仁眼/桃花眼/丹凤眼/圆眼/细长眼/狐狸眼}、眉毛{剑眉/柳叶眉/平眉/拱眉/浓眉/淡眉}、鼻子{高挺鼻/圆鼻头/鹰钩鼻/小翘鼻/直鼻/蒜头鼻}、嘴唇{薄唇/厚唇/M字唇/微笑唇/樱桃小嘴}，可附加特殊标记{泪痣/眉心痣/酒窝/疤痕}；',
    '   （3）整体外貌与发型：体型{纤瘦/匀称/健壮/丰满}、肩型{宽肩/窄肩/平肩/溜肩}、发型{长发及腰/短发利落/双鬟/高髻/披发/束发}、发色{黑色/棕色}；',
    '   （4）服装与姿态：须贴合角色设定时代与身份，写明款式、颜色、材质；',
    '   （5）构图与背景须显式包含正面全身与纯色底，并融入上方「项目视觉风格」与画质词。',
    '   禁止只写剧情动作，须写「长什么样、穿什么」。',
    '3. **ethnicity 与时代贴合**：若剧本为中国历史题材（古装/仙侠/武侠/民国等），角色必须为**东亚人外貌**（黑发黑眼、黄皮肤、东亚五官轮廓），禁止生成欧美人、混血或西方面孔。服装、发型、配饰须严格贴合剧本所在时代背景，不可出现时代错位的现代元素。',
    '4. **outfit**（换装）：保持该角色面部特征、发型与所有标志性细节完全不变，仅将服装更换为：……。服装描写公式：颜色+材质+纹样+款式+配饰。参考词——款式{深衣/襦裙/曲裾/直裰/圆领袍/道袍/袄裙/马面裙/劲装/鹤氅/留仙裙/大袖衫/中山装/旗袍/长衫}、材质{灵蚕纱/天霞锦/云雾纱/丝绸/锦缎/绫/罗/绸/缎/锦/粗布/麻衣/棉/绢}、颜色{月白/朱砂/玄色/藕荷/黛色/紫金/青/白/黑/红/黄/绿/紫/金/银/棕/褐}、纹样{流云暗纹/八卦图/折枝花/龙凤纹/祥云纹/宝相花/联珠纹/团花/鸟兽/太极/莲花}、配饰{玉冠/步摇/簪/钗/花钿/华胜/珠花/丝绦/玉佩/储物袋/荷包/葫芦/剑穗/拂尘/折扇/八卦镜}。纯色影棚背景。整体不超过约120字。',
    '5. **expression / pose**（表情/姿态）：相对 base 明确保持不变与仅变化；建议先锁身份（与 base 同一人）再写表情或体态的差异，避免写成全新人物。',
    '6. 衍生推荐句式：与基础定妆为同一人；保持……不变；仅变化：……。若输出缺显式锚定，服务端可能在落库时补前缀，模型仍应优先输出完整句。',
    '7. 有换装、明显表情或姿态差异时再追加衍生条目；无则不必凑数。',
    '8. **铁律**：每条 characters[].images[] 必须包含非空的「prompt」字符串（中文定妆/换装提示词）；description 仅作辅助说明，不可替代 prompt。',
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
    /** 结构化视觉风格配置（4 维度） */
    visualStyleConfig?: VisualStyleConfig | null
    /** 当前项目场地库名称，供白名单约束，降低模型改写名导致 imagePrompt 不落库 */
    exactLocationNames?: string[]
  },
  log?: ModelCallLogContext,
  provider?: LLMProvider // 新增：可选的自定义提供者
): Promise<{ jsonText: string; cost: DeepSeekCost }> {
  const projectVisualStyleLine = (input.projectVisualStyleLine || '').trim() || '（未指定）'

  const rendered = PromptRegistry.getInstance().render('visual-enrichment', {
    scriptSummary: input.scriptSummary,
    locationLines: input.locationLines,
    characterLines: input.characterLines,
    projectVisualStyleLine,
    exactLocationNames: input.exactLocationNames || []
  })

  const messages: LLMMessage[] = [
    { role: 'system', content: rendered.systemPrompt },
    { role: 'user', content: rendered.userPrompt }
  ]

  // Parser function for the wrapper
  const parseJsonText = (content: string): string => {
    const cleaned = cleanMarkdownCodeBlocks(content)
    return cleaned.trim()
  }

  const template = PromptRegistry.getInstance().getLatest('visual-enrichment')

  const options: LLMCallOptions = {
    provider,
    messages,
    temperature: template.metadata.creativity,
    maxTokens: template.metadata.maxOutputTokens,
    modelLog: log
  }

  const result = await callLLMWithRetry(options, parseJsonText)

  return {
    jsonText: result.content,
    cost: result.cost
  }
}
