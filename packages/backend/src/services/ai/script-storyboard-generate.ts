import type { ScriptContent } from '@dreamer/shared/types'
import type { ModelCallLogContext } from './api-logger.js'
import { logDeepSeekChat } from './model-call-log.js'
import {
  calculateDeepSeekCost,
  getDeepSeekClient,
  DeepSeekAuthError,
  DeepSeekRateLimitError,
  type DeepSeekCost
} from './deepseek-client.js'
import { convertDeepSeekResponse } from './script-expand.js'

/** 与 Prisma Episode / shared Episode 兼容，用于分镜生成入参 */
export interface EpisodeStoryboardInput {
  title?: string | null
  synopsis?: string | null
  script?: unknown
}

/** 至少需要梗概或 `Episode.script` 中有 summary/场次，才能调用 AI 生成分镜剧本 */
export function hasEpisodeContentForStoryboard(episode: EpisodeStoryboardInput): boolean {
  if (episode.synopsis?.trim()) return true
  const rs = episode.script as ScriptContent | undefined
  if (!rs || typeof rs !== 'object') return false
  if (rs.summary?.trim()) return true
  if (Array.isArray(rs.scenes) && rs.scenes.length > 0) return true
  return false
}

const STORYBOARD_SYSTEM_PROMPT = `你是一个专业的短剧分镜导演与编剧，擅长把本集梗概与/或已有剧本转化为结构化「分镜剧本」。
输出必须为 JSON，格式如下（必须严格遵循）：
{
  "title": "剧集标题",
  "summary": "故事梗概",
  "scenes": [
    {
      "sceneNum": 1,
      "location": "场景地点",
      "timeOfDay": "日/夜/晨/昏",
      "characters": ["角色1", "角色2"],
      "description": "场景与镜头描述（可含景别、节奏、情绪）",
      "dialogues": [
        {"character": "角色名", "content": "对话内容"}
      ],
      "actions": ["动作1", "动作2"]
    }
  ]
}
场次数量应覆盖本集叙事节奏，便于后续在「分镜控制台」中逐场生成视频；对话与动作要具体可拍。
请直接返回 JSON 格式，不要包含其他文字。`

const MAX_USER_CHARS = 24000

function truncateForPrompt(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n\n[以上内容过长已截断]`
}

export function buildStoryboardUserPrompt(
  episode: EpisodeStoryboardInput,
  projectContext: string | undefined,
  hint?: string | null
): string {
  const parts: string[] = []
  if (projectContext) {
    parts.push(`项目背景：\n${projectContext}`)
  }
  parts.push(`本集标题：${episode.title?.trim() || '未命名'}`)
  if (episode.synopsis?.trim()) {
    parts.push(`本集梗概：\n${episode.synopsis.trim()}`)
  }
  const rs = episode.script as ScriptContent | undefined
  if (rs) {
    if (rs.summary?.trim()) {
      parts.push(`剧本 summary 字段：\n${rs.summary.trim()}`)
    }
    if (rs.scenes?.length) {
      parts.push(
        `已有剧本场次（可在此基础上细化分镜，也可合理调整）：\n${truncateForPrompt(JSON.stringify(rs.scenes, null, 2), MAX_USER_CHARS)}`
      )
    }
  }
  if (hint?.trim()) {
    parts.push(`额外要求：\n${hint.trim()}`)
  }
  return parts.join('\n\n')
}

export async function generateStoryboardScriptFromEpisode(
  episode: EpisodeStoryboardInput,
  projectContext: string | undefined,
  log: ModelCallLogContext | undefined,
  hint?: string | null
): Promise<{ script: ScriptContent; cost: DeepSeekCost }> {
  const userPrompt = buildStoryboardUserPrompt(episode, projectContext, hint)
  const deepseek = getDeepSeekClient()

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: STORYBOARD_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.65,
        max_tokens: 6000
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      const cost = calculateDeepSeekCost(completion.usage)

      let cleanContent = content
      if (content.includes('```json')) {
        cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      }

      const parsed = JSON.parse(cleanContent)
      const script = convertDeepSeekResponse(parsed)

      if (!script.title || !Array.isArray(script.scenes)) {
        throw new Error('分镜剧本格式不正确')
      }

      await logDeepSeekChat(log, userPrompt, { status: 'completed', costCNY: cost.costCNY }, {
        systemMessage: STORYBOARD_SYSTEM_PROMPT
      })
      return { script, cost }
    } catch (error: any) {
      lastError = error

      if (error?.status === 401 || error?.status === 403) {
        await logDeepSeekChat(log, userPrompt, { status: 'failed', errorMsg: error?.message || 'auth' }, {
          systemMessage: STORYBOARD_SYSTEM_PROMPT
        })
        throw new DeepSeekAuthError()
      }

      if (error?.status === 429 || error?.message?.includes('rate_limit')) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
          continue
        }
        await logDeepSeekChat(log, userPrompt, { status: 'failed', errorMsg: 'rate_limit' }, {
          systemMessage: STORYBOARD_SYSTEM_PROMPT
        })
        throw new DeepSeekRateLimitError()
      }

      if (
        error.message === '分镜剧本格式不正确' ||
        error.message === 'DeepSeek API 返回为空'
      ) {
        await logDeepSeekChat(log, userPrompt, { status: 'failed', errorMsg: error.message }, {
          systemMessage: STORYBOARD_SYSTEM_PROMPT
        })
        throw error
      }

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
    }
  }

  await logDeepSeekChat(log, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || '分镜剧本生成失败'
  }, { systemMessage: STORYBOARD_SYSTEM_PROMPT })
  throw lastError || new Error('分镜剧本生成失败')
}
