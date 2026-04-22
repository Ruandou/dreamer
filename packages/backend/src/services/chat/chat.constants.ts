/** Chat feature constants */

export const CHAT_MAX_CONTEXT_TOKENS = 16_000
export const CHAT_MAX_RESPONSE_TOKENS = 4_000
export const CHAT_MAX_HISTORY_MESSAGES = 40
export const CHAT_TEMPERATURE = 0.7
export const CHAT_STREAM_HEARTBEAT_MS = 15_000
export const CHAT_SCRIPT_CONTEXT_MAX_CHARS = 8_000

/** Quick command definitions */
export interface QuickCommand {
  id: string
  label: string
  instruction: string
}

export const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: 'continue',
    label: '续写',
    instruction: '请根据当前剧本内容续写下一幕场景，保持人物性格和叙事风格一致。'
  },
  {
    id: 'polish',
    label: '润色',
    instruction: '请润色当前剧本的台词和描写，使语言更生动、有画面感，但不改变剧情走向。'
  },
  {
    id: 'expand',
    label: '扩写',
    instruction: '请扩写当前剧本中的动作描写和环境描写，增加画面感和细节。'
  },
  {
    id: 'shorten',
    label: '缩写',
    instruction: '请精简当前剧本中的冗余描述，保留核心情节和关键台词。'
  }
]

export const QUICK_COMMAND_MAP = Object.fromEntries(QUICK_COMMANDS.map((c) => [c.id, c])) as Record<
  string,
  QuickCommand
>
