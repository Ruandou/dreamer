import { describe, it, expect } from 'vitest'

// Inline the parseSuggestedEdit function for testing
function parseSuggestedEdit(
  fullContent: string
): { type: string; content: string; description: string } | null {
  // More robust pattern that handles nested braces and multiline content
  const pattern = /\[EDIT_SUGGESTION\]\s*([\s\S]*?)\[EDIT_SUGGESTION\]/s
  const match = fullContent.match(pattern)
  if (!match) return null

  try {
    // Extract JSON from the matched content (might have extra whitespace/newlines)
    const jsonStr = match[1].trim()
    const parsed = JSON.parse(jsonStr) as {
      type: string
      content: string
      description: string
    }
    if (parsed.type && parsed.content && parsed.description) {
      return parsed
    }
  } catch {
    // malformed JSON, ignore
  }
  return null
}

describe('parseSuggestedEdit', () => {
  it('should parse simple EDIT_SUGGESTION block', () => {
    const content = `Here's your revised script:

[EDIT_SUGGESTION]
{"type": "replace_all", "content": "Scene 1. Test", "description": "Updated script"}
[EDIT_SUGGESTION]

Hope you like it!`

    const result = parseSuggestedEdit(content)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('replace_all')
    expect(result?.content).toBe('Scene 1. Test')
    expect(result?.description).toBe('Updated script')
  })

  it('should parse EDIT_SUGGESTION with multiline JSON', () => {
    const content = `[EDIT_SUGGESTION]
{
  "type": "replace_all",
  "content": "Scene 1. 破旧屋内 - 夜\\n\\n昏暗的灯光",
  "description": "创作了新剧本"
}
[EDIT_SUGGESTION]`

    const result = parseSuggestedEdit(content)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('replace_all')
    expect(result?.content).toContain('Scene 1.')
    expect(result?.description).toBe('创作了新剧本')
  })

  it('should parse EDIT_SUGGESTION with complex script content', () => {
    const content = `我已经为你创作了一个新的剧本：

[EDIT_SUGGESTION]
{
  "type": "replace_all",
  "content": "Scene 1. 屋内 - 夜\\n\\n主角看向窗外。\\n\\nScene 2. 屋外 - 日\\n\\n阳光明媚",
  "description": "根据用户想法创作了完整剧本"
}
[EDIT_SUGGESTION]

请查看并应用修改。`

    const result = parseSuggestedEdit(content)
    expect(result).not.toBeNull()
    expect(result?.content).toContain('Scene 1.')
    expect(result?.content).toContain('Scene 2.')
    expect(result?.description).toBe('根据用户想法创作了完整剧本')
  })

  it('should return null when no EDIT_SUGGESTION block exists', () => {
    const content = `Here's my suggestion for your script.

You could add more dialogue in Scene 2 to build tension.`

    const result = parseSuggestedEdit(content)
    expect(result).toBeNull()
  })

  it('should return null for malformed JSON', () => {
    const content = `[EDIT_SUGGESTION]
{invalid json}
[EDIT_SUGGESTION]`

    const result = parseSuggestedEdit(content)
    expect(result).toBeNull()
  })

  it('should handle EDIT_SUGGESTION with extra whitespace', () => {
    const content = `Some text before

   [EDIT_SUGGESTION]
   
{"type": "replace_all", "content": "New content", "description": "Updated"}
   
   [EDIT_SUGGESTION]

Some text after`

    const result = parseSuggestedEdit(content)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('replace_all')
    expect(result?.content).toBe('New content')
  })

  it('should parse EDIT_SUGGESTION with newlines in content', () => {
    const content = `[EDIT_SUGGESTION]
{"type": "replace_all", "content": "主角说话\\n然后离开", "description": "添加了对话"}
[EDIT_SUGGESTION]`

    const result = parseSuggestedEdit(content)
    expect(result).not.toBeNull()
    expect(result?.content).toContain('主角说话')
  })
})
