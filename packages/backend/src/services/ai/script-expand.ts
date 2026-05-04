import type {
  ScriptContent,
  ScriptScene,
  ScriptDialogueLine,
  ScriptStoryboardShot
} from '@dreamer/shared/types'
import type { ModelCallLogContext } from './api-logger.js'
import type { DeepSeekCost } from './deepseek-client.js'
import {
  type DeepSeekScriptData,
  type DeepSeekScene,
  isEpisodesResponse
} from './deepseek-response-types.js'
import { callLLMWithRetry, parseJsonResponse, type LLMCallOptions } from './llm-call-wrapper.js'
import { type LLMProvider } from './llm-factory.js'
import { PromptRegistry } from '../prompts/registry.js'
import type { LLMMessage } from './llm-provider.js'

// 转换 DeepSeek 返回的格式到内部格式
export function convertDeepSeekResponse(data: DeepSeekScriptData): ScriptContent {
  // 处理 DeepSeek 可能返回的嵌套结构
  let scenesArray: DeepSeekScene[] = []

  if (isEpisodesResponse(data) && data.episodes && data.episodes.length > 0) {
    // 嵌套 episodes[].scenes[] 格式
    scenesArray = data.episodes[0].scenes || []
  } else if ('scenes' in data && Array.isArray(data.scenes)) {
    // 标准格式
    scenesArray = data.scenes
  }

  const scenes: ScriptScene[] = scenesArray.map((s: DeepSeekScene) => {
    // 处理 dialogues - 可能是数组或对象
    let dialogues: ScriptDialogueLine[] = []
    if (Array.isArray(s.dialogues)) {
      dialogues = s.dialogues.map((d) => ({
        character: d.character || d.name || '',
        content: d.content || d.line || ''
      }))
    } else if (s.dialogue && typeof s.dialogue === 'object') {
      // 对话是对象形式 { "角色名": "内容" }
      dialogues = Object.entries(s.dialogue).map(([character, content]) => ({
        character,
        content: content as string
      }))
    }

    // 处理 actions - 可能是字符串或数组
    let actions: string[] = []
    if (Array.isArray(s.actions)) {
      actions = s.actions
    } else if (typeof s.action === 'string') {
      // 将单个 action 字符串分割成数组
      actions = s.action.split(/(?<=[。！？；.!?;])/).filter(Boolean)
    }

    let shots: ScriptStoryboardShot[] | undefined
    if (Array.isArray(s.shots) && s.shots.length > 0) {
      shots = s.shots.map((sh) => ({
        shotNum: sh.shotNum ?? sh.order ?? 1,
        order: sh.order ?? sh.shotNum ?? 1,
        description: sh.description || '',
        cameraAngle: sh.cameraAngle,
        cameraMovement: sh.cameraMovement,
        duration: typeof sh.duration === 'number' ? sh.duration : undefined,
        characters: Array.isArray(sh.characters)
          ? sh.characters.map((c) => ({
              characterName: c.characterName || c.name || '',
              imageName: c.imageName || '基础形象',
              action: c.action
            }))
          : undefined
      }))
    }

    return {
      sceneNum: s.sceneNum || s.scene_number || 1,
      location: s.location || '',
      timeOfDay: s.timeOfDay || s.time || '日',
      characters: Array.isArray(s.characters) ? s.characters : [],
      description: s.description || '',
      dialogues,
      actions,
      ...(shots && shots.length > 0 ? { shots } : {})
    }
  })

  return {
    title: data.title || data.episode_title || '未命名剧本',
    summary: data.summary || '',
    scenes
  }
}

export async function expandScript(
  summary: string,
  projectContext?: string,
  log?: ModelCallLogContext,
  provider?: LLMProvider // 新增：可选的自定义提供者
): Promise<{ script: ScriptContent; cost: DeepSeekCost }> {
  const template = PromptRegistry.getInstance().getLatest('script-expand')

  const rendered = PromptRegistry.getInstance().render('script-expand', {
    summary,
    projectContext: projectContext || ''
  })

  const messages: LLMMessage[] = [
    { role: 'system', content: rendered.systemPrompt },
    { role: 'user', content: rendered.userPrompt }
  ]

  // Parser function for the wrapper
  const parseScript = (content: string): ScriptContent => {
    // 使用带自动修复的 JSON 解析
    const parsed = parseJsonResponse<DeepSeekScriptData>(content)

    // 转换格式
    const script = convertDeepSeekResponse(parsed)

    // 验证结构
    if (!script.title || !Array.isArray(script.scenes)) {
      throw new Error('剧本格式不正确')
    }

    return script
  }

  const options: LLMCallOptions = {
    provider,
    messages,
    temperature: template.metadata.creativity,
    maxTokens: template.metadata.maxOutputTokens,
    modelLog: log
  }

  const result = await callLLMWithRetry(options, parseScript)

  return {
    script: result.content,
    cost: result.cost
  }
}
