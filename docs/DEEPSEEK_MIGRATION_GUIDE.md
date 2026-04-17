# DeepSeek API Call Migration Guide

## Overview

This guide documents the migration from manual retry logic to the new `callDeepSeekWithRetry` wrapper function.

## Migration Status

### ✅ Completed (1/8)
- **script-expand.ts** - Successfully migrated, all tests passing (10/10)

### ⏳ Remaining (7/8)
- parser.ts
- scene-prompt-optimize.ts
- script-storyboard-generate.ts
- character-identity-merge.ts
- character-slot-image-prompt.ts
- script-visual-enrichment.ts
- script-writer.ts (4 functions)

---

## Migration Pattern

### Before (Manual Retry Logic - ~70 lines)

```typescript
import { logDeepSeekChat } from './model-call-log.js'
import {
  calculateDeepSeekCost,
  getDeepSeekClient,
  DeepSeekAuthError,
  DeepSeekRateLimitError
} from './deepseek-client.js'
import {
  DEEPSEEK_TEMPERATURE,
  DEEPSEEK_MAX_TOKENS,
  DEFAULT_RETRY_ATTEMPTS,
  AUTH_RETRY_DELAY_MS,
  RETRY_BASE_DELAY_MS,
  AUTH_ERROR_STATUS_CODES,
  RATE_LIMIT_STATUS_CODE
} from './ai.constants.js'

export async function myFunction(
  input: string,
  log?: ModelCallLogContext
): Promise<{ result: MyType; cost: DeepSeekCost }> {
  const deepseek = getDeepSeekClient()
  const userPrompt = buildPrompt(input)
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: DEEPSEEK_TEMPERATURE.MY_FUNCTION,
        max_tokens: DEEPSEEK_MAX_TOKENS.MY_FUNCTION
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      const cost = calculateDeepSeekCost(completion.usage)
      const parsed = JSON.parse(content)
      const result = processResult(parsed)

      await logDeepSeekChat(log, userPrompt, {
        status: 'completed',
        costCNY: cost.costCNY
      })
      return { result, cost }
    } catch (error: any) {
      lastError = error

      if (AUTH_ERROR_STATUS_CODES.includes(error?.status)) {
        await logDeepSeekChat(log, userPrompt, {
          status: 'failed',
          errorMsg: error?.message || 'auth'
        })
        throw new DeepSeekAuthError()
      }

      if (error?.status === RATE_LIMIT_STATUS_CODE || error?.message?.includes('rate_limit')) {
        if (attempt < DEFAULT_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, AUTH_RETRY_DELAY_MS * attempt))
          continue
        }
        await logDeepSeekChat(log, userPrompt, {
          status: 'failed',
          errorMsg: 'rate_limit'
        })
        throw new DeepSeekRateLimitError()
      }

      if (attempt < DEFAULT_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_BASE_DELAY_MS))
        continue
      }
    }
  }

  await logDeepSeekChat(log, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || '调用失败'
  })
  throw lastError || new Error('调用失败')
}
```

### After (Using Wrapper - ~25 lines)

```typescript
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

export async function myFunction(
  input: string,
  log?: ModelCallLogContext
): Promise<{ result: MyType; cost: DeepSeekCost }> {
  const deepseek = getDeepSeekClient()
  const userPrompt = buildPrompt(input)

  // Parser function for the wrapper
  const parseResult = (content: string): MyType => {
    const cleanContent = cleanMarkdownCodeBlocks(content)
    const parsed = JSON.parse(cleanContent)
    return processResult(parsed)
  }

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: DEEPSEEK_TEMPERATURE.MY_FUNCTION,
    maxTokens: DEEPSEEK_MAX_TOKENS.MY_FUNCTION,
    modelLog: log
  }

  const result = await callDeepSeekWithRetry(options, parseResult)

  return {
    result: result.content,
    cost: result.cost
  }
}
```

---

## Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Lines of Code** | ~70 | ~25 | **-64%** |
| **Cyclomatic Complexity** | High (nested try/catch/ifs) | Low (linear) | **Much simpler** |
| **Error Handling** | Manual, error-prone | Centralized, tested | **More reliable** |
| **Logging** | Scattered throughout | Single point in wrapper | **Consistent** |
| **Retry Logic** | Duplicated everywhere | Reusable wrapper | **DRY principle** |
| **Test Coverage** | Hard to test | Wrapper tested once | **Easier testing** |

---

## Migration Steps for Each File

### Step 1: Update Imports

**Remove:**
```typescript
import { logDeepSeekChat } from './model-call-log.js'
import {
  calculateDeepSeekCost,
  DeepSeekAuthError,
  DeepSeekRateLimitError
} from './deepseek-client.js'
import {
  DEFAULT_RETRY_ATTEMPTS,
  AUTH_RETRY_DELAY_MS,
  RETRY_BASE_DELAY_MS,
  AUTH_ERROR_STATUS_CODES,
  RATE_LIMIT_STATUS_CODE
} from './ai.constants.js'
```

**Add:**
```typescript
import { getDeepSeekClient, type DeepSeekCost } from './deepseek-client.js'
import {
  DEEPSEEK_TEMPERATURE,
  DEEPSEEK_MAX_TOKENS
} from './ai.constants.js'
import {
  callDeepSeekWithRetry,
  cleanMarkdownCodeBlocks, // if parsing JSON
  type DeepSeekCallOptions
} from './deepseek-call-wrapper.js'
```

### Step 2: Create Parser Function

```typescript
const parseResponse = (content: string): MyResultType => {
  // Clean markdown if needed
  const cleanContent = cleanMarkdownCodeBlocks(content)
  
  // Parse and validate
  const parsed = JSON.parse(cleanContent)
  
  // Transform to your type
  const result = transformData(parsed)
  
  // Validate
  if (!isValid(result)) {
    throw new Error('Invalid result format')
  }
  
  return result
}
```

### Step 3: Replace Retry Loop with Wrapper Call

```typescript
const options: DeepSeekCallOptions = {
  client: deepseek,
  model: 'deepseek-chat', // optional, this is the default
  systemPrompt: YOUR_SYSTEM_PROMPT,
  userPrompt: yourUserPrompt,
  temperature: DEEPSEEK_TEMPERATURE.YOUR_FUNCTION,
  maxTokens: DEEPSEEK_MAX_TOKENS.YOUR_FUNCTION,
  modelLog: log // optional
}

const result = await callDeepSeekWithRetry(options, parseResponse)

return {
  result: result.content,
  cost: result.cost
}
```

---

## File-Specific Notes

### parser.ts
- **Complexity**: Medium
- **Special**: Uses `calculateDeepSeekCost(completion.usage, false)` - wrapper uses default (no cache hit)
- **Parser function**: Needs `normalizeParsedData()` call
- **Lines reduction**: ~90 → ~30

### scene-prompt-optimize.ts
- **Complexity**: Low
- **Special**: Simple JSON response
- **Lines reduction**: ~50 → ~20

### script-storyboard-generate.ts
- **Complexity**: Medium
- **Special**: Has custom validation logic
- **Lines reduction**: ~100 → ~35

### character-identity-merge.ts
- **Complexity**: Low
- **Special**: No retry loop (single attempt)
- **Lines reduction**: ~40 → ~20

### character-slot-image-prompt.ts
- **Complexity**: Low
- **Special**: Very simple, no retry
- **Lines reduction**: ~35 → ~18

### script-visual-enrichment.ts
- **Complexity**: Medium
- **Special**: Complex user prompt building
- **Lines reduction**: ~60 → ~25

### script-writer.ts (4 functions)
- **Complexity**: High
- **Functions to migrate**:
  - `writeScriptFromIdea`
  - `writeEpisodeForProject`
  - `expandScript` (already done!)
  - `optimizeSceneDescription`
- **Special**: Each has slightly different error handling
- **Lines reduction**: ~200 → ~80 (across all 4 functions)

---

## Testing Strategy

After migrating each file:

1. **Run existing tests**:
   ```bash
   pnpm vitest run tests/<file-name>.test.ts
   ```

2. **Verify no regressions**:
   ```bash
   pnpm vitest run
   ```

3. **Check coverage**:
   ```bash
   pnpm vitest run --coverage
   ```

All wrapper logic is already tested in `deepseek-call-wrapper.test.ts` (24 tests, 100% coverage).

---

## Common Pitfalls

### ❌ Don't forget to export error classes if needed

If other files import `DeepSeekAuthError` or `DeepSeekRateLimitError` from your file:

```typescript
// Keep re-exporting for backward compatibility
export { DeepSeekAuthError, DeepSeekRateLimitError } from './deepseek-client.js'
```

### ❌ Don't break the parser function

The parser function MUST throw on invalid data:

```typescript
const parseResponse = (content: string): MyType => {
  const result = transform(JSON.parse(content))
  if (!result.isValid) {
    throw new Error('Invalid data') // This prevents logging as "completed"
  }
  return result
}
```

### ✅ Do use cleanMarkdownCodeBlocks for JSON responses

```typescript
const cleanContent = cleanMarkdownCodeBlocks(content)
const parsed = JSON.parse(cleanContent)
```

---

## Success Metrics

After completing all migrations:

- **Total lines removed**: ~500 lines
- **Code duplication eliminated**: 8 retry loops → 1 wrapper
- **Test coverage**: Maintained or improved
- **Maintainability**: Significantly improved
- **Bug risk**: Reduced (centralized error handling)

---

## Next Steps

1. Migrate remaining 7 files using this guide
2. Run full test suite after each migration
3. Update this document with completion status
4. Consider deprecating direct `deepseek.chat.completions.create` calls
5. Add ESLint rule to prevent new direct calls

---

## Reference

- **Wrapper implementation**: `src/services/ai/deepseek-call-wrapper.ts`
- **Wrapper tests**: `tests/deepseek-call-wrapper.test.ts` (24 tests)
- **First migration example**: `src/services/ai/script-expand.ts`
