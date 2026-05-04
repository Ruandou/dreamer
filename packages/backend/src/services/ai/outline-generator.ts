/**
 * 短剧大纲生成服务
 * 提供强化的 Prompt 模板、JSON 修复、集数对齐等功能
 */

import { callLLMWithRetry, parseJsonResponse } from './llm/llm-call-wrapper.js'
import { getDefaultProvider } from './llm-factory.js'
import { repairJsonWithAI } from './json-repair.js'
import type { ModelCallLogContext } from './api-logger.js'
import { logInfo, logWarning } from '../../lib/error-logger.js'

export interface EpisodeOutline {
  episodeNum: number
  title: string
  synopsis: string
  hook: string
  cliffhanger: string
  isPaywall?: boolean
}

export interface GenerateOutlineOptions {
  templateName: string
  templateStructure: Record<string, unknown>
  paywallEpisodes: number[]
  protagonistName: string
  protagonistIdentity: string
  coreConflict: string
  targetAudience: string
  targetEpisodes: number
  userId: string
  projectId: string
}

const FEW_SHOT_EXAMPLE = `示例（赘婿逆袭流，主角：林凡，身份：隐世家族继承人）：

第1集：
- title: "婚宴受辱，废物女婿"
- synopsis: "林凡在婚宴上被丈母娘当众羞辱，妻子苏婉清默默流泪，林凡隐忍不发。"
- hook: "豪门婚宴，一个穿着廉价西装的男人被丈母娘指着鼻子骂：'你就是个废物！'"
- cliffhanger: "林凡低头看着手机上的短信，瞳孔骤缩——'少主，家族急召。'"

第2集：
- title: "家族密令，身份将揭"
- synopsis: "林凡收到家族密令，得知隐世林家遭遇危机。与此同时，苏家生意陷入困境。"
- hook: "深夜，林凡独自站在阳台，手中的古朴玉佩泛着微光。"
- cliffhanger: "苏婉清推开阳台门，正好看见林凡将玉佩收起，她皱眉：'那是什么？'"

注意：
1. hook 必须在前3句抓住观众，包含冲突或悬念
2. cliffhanger 必须让观众想点下一集
3. 付费卡点（第10、20、30集）的 cliffhanger 必须是最强悬念`

function buildPrompt(options: GenerateOutlineOptions): string {
  const {
    templateName,
    templateStructure,
    paywallEpisodes,
    protagonistName,
    protagonistIdentity,
    coreConflict,
    targetAudience,
    targetEpisodes
  } = options

  return `你是一位资深短剧编剧，擅长"${templateName}"题材，曾创作过多部播放量破亿的短剧。

请根据以下核心设定，生成${targetEpisodes}集短剧大纲：

核心设定：
- 主角：${protagonistName}，${protagonistIdentity}
- 核心矛盾：${coreConflict}
- 目标受众：${targetAudience}

模板结构参考：
${JSON.stringify(templateStructure, null, 2)}

${FEW_SHOT_EXAMPLE}

要求：
1. 每集必须包含以下字段（缺一不可）：
   - episodeNum: 整数集数（1-${targetEpisodes}）
   - title: 标题（8-15字，有冲击力）
   - synopsis: 一句话梗概（30-50字，说清楚本集核心事件）
   - hook: 开头钩子（前3句必须抓住观众，包含冲突/悬念/情绪）
   - cliffhanger: 结尾悬念（让观众迫不及待想看下一集）
   - isPaywall: 布尔值，仅第${paywallEpisodes.join('、')}集为 true

2. 剧情节奏：
   - 每3集必须有一个爽点（打脸/反转/身份揭露/情绪爆发）
   - 付费卡点集（${paywallEpisodes.join('、')}）的 cliffhanger 必须是全剧最强悬念
   - 避免剧情拖沓，每集推进一个核心事件

3. 输出格式：
   - 只输出纯 JSON，不要 markdown 代码块，不要任何解释文字
   - 格式：{ "episodes": [ { "episodeNum": 1, "title": "...", "synopsis": "...", "hook": "...", "cliffhanger": "...", "isPaywall": false }, ... ] }
   - 确保 JSON 语法正确：键名用双引号，无尾随逗号

4. 自检指令（生成完成后请检查）：
   - 集数是否正好 ${targetEpisodes} 集
   - 每个 episode 是否都有 episodeNum/title/synopsis/hook/cliffhanger/isPaywall
   - isPaywall 是否只在第 ${paywallEpisodes.join('、')} 集为 true
   - JSON 语法是否合法`
}

/**
 * 验证并修复单集结构
 */
function validateAndFixEpisode(ep: unknown, episodeNum: number): EpisodeOutline {
  if (!ep || typeof ep !== 'object') {
    throw new Error(`第${episodeNum}集数据格式错误`)
  }

  const e = ep as Record<string, unknown>

  const requiredFields = ['title', 'synopsis', 'hook', 'cliffhanger']
  for (const field of requiredFields) {
    if (!e[field] || typeof e[field] !== 'string' || (e[field] as string).trim() === '') {
      throw new Error(`第${episodeNum}集缺少必填字段：${field}`)
    }
  }

  return {
    episodeNum: typeof e.episodeNum === 'number' ? e.episodeNum : episodeNum,
    title: String(e.title).trim(),
    synopsis: String(e.synopsis).trim(),
    hook: String(e.hook).trim(),
    cliffhanger: String(e.cliffhanger).trim(),
    isPaywall: Boolean(e.isPaywall)
  }
}

/**
 * 对齐集数：不足则填充，超量则截断
 */
function alignEpisodes(
  episodes: EpisodeOutline[],
  targetEpisodes: number,
  paywallEpisodes: number[]
): EpisodeOutline[] {
  const result: EpisodeOutline[] = []

  // 去重并按集数排序
  const map = new Map<number, EpisodeOutline>()
  for (const ep of episodes) {
    if (ep.episodeNum >= 1 && ep.episodeNum <= targetEpisodes) {
      map.set(ep.episodeNum, ep)
    }
  }

  // 填充缺失的集数
  for (let i = 1; i <= targetEpisodes; i++) {
    const existing = map.get(i)
    if (existing) {
      result.push(existing)
    } else {
      // 用最后一集的结构循环填充
      const lastValid = episodes[episodes.length - 1] || result[result.length - 1]
      result.push({
        episodeNum: i,
        title: `第${i}集：剧情推进`,
        synopsis: `第${i}集承接上文，推进主线剧情。`,
        hook: lastValid?.hook || '悬念再起，危机逼近。',
        cliffhanger: lastValid?.cliffhanger || '真相即将浮出水面...',
        isPaywall: paywallEpisodes.includes(i)
      })
    }
  }

  // 确保付费卡点正确
  for (const ep of result) {
    ep.isPaywall = paywallEpisodes.includes(ep.episodeNum)
  }

  // 如果最后一集是截断的，确保有收尾感
  const lastEp = result[result.length - 1]
  if (lastEp.cliffhanger.includes('...') || lastEp.cliffhanger.length < 10) {
    lastEp.cliffhanger = '一切尘埃落定，但新的风暴正在酝酿...'
  }

  return result
}

/**
 * 尝试多种方式解析 JSON 响应
 */
async function robustParseJson(
  content: string,
  logContext?: ModelCallLogContext
): Promise<{ episodes: unknown[] }> {
  // 尝试1: 直接解析
  try {
    const parsed = parseJsonResponse<{ episodes: unknown[] }>(content, true)
    if (parsed.episodes && Array.isArray(parsed.episodes)) {
      return parsed
    }
  } catch {
    logWarning('OutlineGen', '直接解析失败，尝试修复...')
  }

  // 尝试2: 提取 JSON 数组（有时 LLM 只返回数组）
  const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (arrayMatch) {
    try {
      const episodes = JSON.parse(arrayMatch[0]) as unknown[]
      return { episodes }
    } catch {
      // continue
    }
  }

  // 尝试3: AI 修复
  try {
    logInfo('OutlineGen', '使用 AI 修复 JSON...')
    const repaired = await repairJsonWithAI(content, logContext)
    const parsed = parseJsonResponse<{ episodes: unknown[] }>(repaired, true)
    if (parsed.episodes && Array.isArray(parsed.episodes)) {
      return parsed
    }
  } catch {
    logWarning('OutlineGen', 'AI 修复也失败了')
  }

  throw new Error('无法解析 LLM 返回的 JSON')
}

/**
 * 生成短剧大纲
 */
export async function generateOutline(options: GenerateOutlineOptions): Promise<EpisodeOutline[]> {
  const provider = getDefaultProvider()
  const prompt = buildPrompt(options)

  logInfo('OutlineGen', '开始生成大纲', {
    template: options.templateName,
    targetEpisodes: options.targetEpisodes,
    projectId: options.projectId
  })

  const result = await callLLMWithRetry<{ episodes: unknown[] }>(
    {
      provider,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8000,
      modelLog: {
        userId: options.userId,
        projectId: options.projectId,
        op: 'generate_outline'
      }
    },
    async (content) =>
      robustParseJson(content, {
        userId: options.userId,
        projectId: options.projectId,
        op: 'generate_outline_parse'
      })
  )

  const rawEpisodes = result.content.episodes || []

  // 验证并修复每集结构
  const validatedEpisodes: EpisodeOutline[] = []
  for (let i = 0; i < rawEpisodes.length; i++) {
    const ep = rawEpisodes[i]
    const expectedNum =
      typeof ep === 'object' && ep !== null && 'episodeNum' in ep
        ? (ep as { episodeNum?: number }).episodeNum || i + 1
        : i + 1

    try {
      validatedEpisodes.push(validateAndFixEpisode(ep, expectedNum))
    } catch (err) {
      logWarning('OutlineGen', `第${expectedNum}集验证失败，使用默认值`, {
        error: err instanceof Error ? err.message : String(err)
      })
      validatedEpisodes.push({
        episodeNum: expectedNum,
        title: `第${expectedNum}集`,
        synopsis: '剧情推进中...',
        hook: '悬念再起...',
        cliffhanger: '下集揭晓...',
        isPaywall: options.paywallEpisodes.includes(expectedNum)
      })
    }
  }

  // 对齐集数
  const alignedEpisodes = alignEpisodes(
    validatedEpisodes,
    options.targetEpisodes,
    options.paywallEpisodes
  )

  logInfo('OutlineGen', '大纲生成完成', {
    episodeCount: alignedEpisodes.length,
    paywallCount: alignedEpisodes.filter((e) => e.isPaywall).length
  })

  return alignedEpisodes
}
