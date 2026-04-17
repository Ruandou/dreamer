import type { ScriptContent } from '@dreamer/shared/types'
import type { ModelCallLogContext } from './api-logger.js'
import { getDeepSeekClient, type DeepSeekCost } from './deepseek-client.js'
import { DEEPSEEK_TEMPERATURE, DEEPSEEK_MAX_TOKENS } from './ai.constants.js'
import type { ParsedCharacter } from './parsed-script-types.js'
import { normalizeParsedCharacterList } from './parsed-script-types.js'
import { callDeepSeekWithRetry, type DeepSeekCallOptions } from './deepseek-call-wrapper.js'
interface CharacterIdentityMergeResult {
  characters: ParsedCharacter[]
  /** 非规范称谓 -> 规范名（含与自身相等的映射时可忽略） */
  aliasToCanonical: Record<string, string>
}

const CHARACTER_IDENTITY_MERGE_SYSTEM = `你是中文短剧剧本角色归一助手。只输出一段合法 JSON，不要 markdown、不要解释。

输出结构：
{
  "aliasToCanonical": { "剧中出现的称谓": "规范角色名" },
  "characters": [
    {
      "name": "规范角色名（唯一主名）",
      "description": "整体人设与外貌共性",
      "aliases": ["可选，剧本中出现的其他称谓"],
      "images": [
        { "name": "基础形象", "type": "base", "description": "最常见装扮的具象描述" },
        { "name": "某套装扮", "type": "outfit", "description": "该身份/服装下的描述" }
      ]
    }
  ]
}

规则：
1. 同一人物的不同称呼、官职、场景标签（如「宋工部尚书」「宋家居形象」）必须映射到同一规范名，并写入 aliasToCanonical。
2. 每个真实人物只对应 characters 中一条；images 至少一条 type 为 base。
3. 身份/服装差异用 type=outfit 槽位，不要拆成多个角色。`

function extractJsonObject(text: string): string {
  const t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) return fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) return t.slice(start, end + 1)
  return t
}

function buildMergeUserScript(script: ScriptContent, uniqueNames: string[]): string {
  const lines: string[] = [
    `剧本标题：${script.title}`,
    `梗概：${script.summary}`,
    '',
    '【剧本中出现的角色称谓（去重）】',
    uniqueNames.join('、') || '（无）',
    '',
    '【各场摘录：场景号、本场角色列表、对白说话人】'
  ]
  for (const scene of script.scenes.slice(0, 80)) {
    const ch = (scene.characters || []).join('、')
    const speakers = (scene.dialogues || []).map((d) => d.character).filter(Boolean)
    const sp = [...new Set(speakers)].join('、')
    lines.push(`场${scene.sceneNum}：角色=${ch || '—'}；说话人=${sp || '—'}`)
  }
  return lines.join('\n\n')
}

function normalizeMergePayload(data: any): CharacterIdentityMergeResult {
  const aliasRaw = data?.aliasToCanonical
  const aliasToCanonical: Record<string, string> = {}
  if (aliasRaw && typeof aliasRaw === 'object' && !Array.isArray(aliasRaw)) {
    for (const [k, v] of Object.entries(aliasRaw)) {
      const key = String(k).trim()
      const val = String(v).trim()
      if (key && val) aliasToCanonical[key] = val
    }
  }

  let characters: ParsedCharacter[] = []
  if (Array.isArray(data?.characters)) {
    characters = data.characters.map((c: any) => {
      const images = Array.isArray(c.images)
        ? c.images.map((img: any) => ({
            name: String(img?.name || '').trim() || '基础形象',
            type: String(img?.type || 'base').toLowerCase(),
            description: String(img?.description || '').trim()
          }))
        : undefined
      const aliases = Array.isArray(c.aliases)
        ? c.aliases.map((a: any) => String(a).trim()).filter(Boolean)
        : undefined
      return {
        name: String(c.name || '').trim(),
        description: String(c.description || '').trim(),
        aliases,
        images
      }
    })
    characters = normalizeParsedCharacterList(characters)
  }

  return { characters, aliasToCanonical }
}

export async function fetchCharacterIdentityMerge(
  script: ScriptContent,
  uniqueNames: string[],
  log?: ModelCallLogContext
): Promise<{ result: CharacterIdentityMergeResult; cost: DeepSeekCost }> {
  const user = buildMergeUserScript(script, uniqueNames)
  const deepseek = getDeepSeekClient()

  // Parser function for the wrapper
  const parseMergeResult = (text: string): CharacterIdentityMergeResult => {
    const raw = extractJsonObject(text)
    const parsed = JSON.parse(raw)
    return normalizeMergePayload(parsed)
  }

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: CHARACTER_IDENTITY_MERGE_SYSTEM,
    userPrompt: user,
    temperature: DEEPSEEK_TEMPERATURE.CHARACTER_MERGE,
    maxTokens: DEEPSEEK_MAX_TOKENS.CHARACTER_MERGE,
    modelLog: log
  }

  const result = await callDeepSeekWithRetry(options, parseMergeResult)

  return {
    result: result.content,
    cost: result.cost
  }
}
