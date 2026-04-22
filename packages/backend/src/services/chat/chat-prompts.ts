/** System prompt builder for the AI screenwriter assistant */

import { CHAT_SCRIPT_CONTEXT_MAX_CHARS, QUICK_COMMAND_MAP } from './chat.constants.js'

export interface BuildSystemPromptOptions {
  scriptContent?: string
  scriptTitle?: string
  quickCommand?: string
}

export function buildSystemPrompt(options: BuildSystemPromptOptions = {}): string {
  const { scriptContent, scriptTitle, quickCommand } = options

  const parts: string[] = []

  // Base persona
  parts.push(
    `你是一个专业的AI编剧助手，擅长短剧剧本创作和修改。你精通剧本格式、人物塑造、情节设计和台词创作。` +
      `请根据用户的需求，提供专业、有创意的编剧建议。`
  )

  // Script context
  if (scriptContent) {
    const truncated =
      scriptContent.length > CHAT_SCRIPT_CONTEXT_MAX_CHARS
        ? scriptContent.slice(0, CHAT_SCRIPT_CONTEXT_MAX_CHARS) + '\n\n（剧本内容过长，已截断）'
        : scriptContent

    parts.push(
      `\n---\n当前正在编辑的剧本：${scriptTitle || '未命名'}\n\n` +
        '剧本内容：\n```\n' +
        truncated +
        '\n```\n' +
        '请在回复时考虑以上剧本内容，保持人物、情节和风格的一致性。'
    )
  }

  // Quick command context
  if (quickCommand) {
    const command = QUICK_COMMAND_MAP[quickCommand]
    if (command) {
      parts.push(
        `\n\n用户使用了快捷指令「${command.label}」，请执行以下操作：\n${command.instruction}`
      )
    }
  }

  // Edit suggestion format instruction
  parts.push(
    '\n\n---\n当用户要求修改剧本内容时，请在回复中包含一个 `[EDIT_SUGGESTION]` 代码块，格式如下：\n\n' +
      `[EDIT_SUGGESTION]\n` +
      `{"type": "replace_all", "content": "修改后的完整剧本内容", "description": "简要描述修改了什么"}\n` +
      `[EDIT_SUGGESTION]\n\n` +
      `如果没有涉及剧本修改，则不需要包含此代码块。` +
      `请确保 JSON 格式正确，可以被正常解析。`
  )

  return parts.join('')
}
