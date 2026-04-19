# Dreamer AI 代码审查清单

## 使用说明

在收到 AI 生成的代码后，**直接复制以下内容**让 AI 自查：

```text
请严格按照《Dreamer 编码规范》审查以下代码，指出所有违反条款的具体位置，并给出符合规范的修改建议。

重点检查：
1. 是否使用了 `any` 类型（除非有注释说明）
2. 是否正确处理外部 `unknown` 数据（Zod 校验或类型守卫）
3. 函数命名是否符合前缀表（generateXxx/callXxx/buildXxx）
4. 是否吞掉了错误（空 catch 块）
5. AI 模型调用是否缺少日志上下文（op、model、cost）
6. 是否缺少错误分类（可重试/不可重试）
```

---

## 核心规范检查项

### 1. 类型安全（强制）

- [ ] **禁止使用 `any`**
  - ❌ `const data: any = JSON.parse(response)`
  - ✅ `const data: unknown = JSON.parse(response)` + Zod 校验/类型守卫
  - 例外：必须有注释说明 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`

- [ ] **外部数据必须校验**
  - ❌ `const config = JSON.parse(raw).voiceConfig as VoiceConfig`
  - ✅ `const parsed = voiceConfigSchema.parse(JSON.parse(raw))`

- [ ] **使用类型安全的辅助函数**
  - ❌ `(request as any).user.id`
  - ✅ `getRequestUserId(request)` 或 `getRequestUser(request)`

### 2. 函数命名规范

| 前缀       | 用途            | 示例                                    |
| ---------- | --------------- | --------------------------------------- |
| `generate` | 构造提示词/数据 | `generatePrompt()`, `generatePayload()` |
| `call`     | 实际 API 请求   | `callDeepSeek()`, `callSeedance()`      |
| `build`    | 组装数据结构    | `buildSeedanceAudio()`, `buildQuery()`  |
| `create`   | 数据库操作      | `createProject()`, `createEpisode()`    |
| `fetch`    | 从外部获取      | `fetchRemoteData()`, `fetchAsset()`     |
| `validate` | 校验逻辑        | `validateSchema()`, `validateInput()`   |

- [ ] 所有函数名符合 **动词+名词** 规则
- [ ] 避免模糊命名：`processData()`, `handleStuff()`, `doThing()`

### 3. AI 模型调用（强制）

- [ ] **必须记录 ModelApiCall**

  ```typescript
  // ✅ 正确示例
  await recordModelApiCall({
    userId: context.userId,
    op: 'generate-script',
    model: 'deepseek-chat',
    provider: 'deepseek',
    status: 'success',
    cost: 0.002,
    projectId: context.projectId
  })
  ```

- [ ] **传入日志上下文**

  ```typescript
  // ✅ 正确示例
  const context: ModelCallLogContext = {
    userId: requestUser.id,
    op: 'generate-storyboard',
    projectId: episode.projectId
  }
  await callLLM(prompt, context)
  ```

- [ ] **终端输出日志**
  ```
  [model-api] deepseek deepseek-chat success op=generate-script
  ```

### 4. 错误处理

- [ ] **禁止吞掉错误**
  - ❌ `catch (e) { /* ignore */ }`
  - ❌ `catch (e) { console.log(e) }`（仅打印，未抛出）
  - ✅ `catch (error) { logger.error('Failed to...', error); throw new AIGenerationError('...') }`

- [ ] **错误必须分类**

  ```typescript
  // ✅ 可重试错误
  if (isRateLimitError(error)) {
    throw new RetryableError('Rate limited, retry after 60s')
  }

  // ✅ 不可重试错误
  if (isInvalidApiKey(error)) {
    throw new NonRetryableError('Invalid API key')
  }
  ```

- [ ] **使用具体错误类型**
  - `AIGenerationError` - AI 生成失败
  - `ValidationError` - 数据校验失败
  - `RetryableError` - 可重试错误
  - `NonRetryableError` - 不可重试错误

### 5. 环境变量加载

- [ ] **后端入口文件第一行必须是**

  ```typescript
  import './bootstrap-env.js'
  // 然后才能 import 其他业务代码
  import Fastify from 'fastify'
  import { PrismaClient } from '@prisma/client'
  ```

- [ ] **禁止错误模式**
  ```typescript
  // ❌ 错误：其他 import 在 config() 之前
  import { config } from 'dotenv'
  config({ path: '../../.env' })
  import Fastify from 'fastify' // 可能已经读了空的 env
  ```

### 6. 数据库操作（Prisma）

- [ ] **避免过宽的 select**
  - ❌ `await prisma.project.findMany()`（返回所有字段）
  - ✅ `await prisma.project.findMany({ select: { id: true, name: true } })`

- [ ] **谨慎使用 include**
  - ❌ `include: { episodes: true, assets: true, scripts: true }`（N+1 查询）
  - ✅ 按需 include，或使用多次查询

- [ ] **禁止使用 `--force-reset`**
  - ✅ 只用 `pnpm db:push` 增量更新
  - ✅ 需要迁移时用 `pnpm db:migrate`

### 7. API 响应格式

- [ ] **新 API 使用 envelope 格式**

  ```typescript
  // ✅ 正确格式
  return {
    success: true,
    data: project,
    error: undefined
  }

  // ❌ 避免直接返回资源
  return project
  ```

- [ ] **错误响应统一格式**
  ```typescript
  return {
    success: false,
    data: undefined,
    error: 'Project not found'
  }
  ```

---

## PR 模板检查项

在提交 PR 时，必须勾选以下检查项：

```markdown
## 代码质量检查

- [ ] 未使用 `any` 类型（或已添加注释说明）
- [ ] 外部 JSON 数据使用 `unknown` + Zod 校验
- [ ] 函数命名符合动词+名词规则
- [ ] AI 模型调用已记录 ModelApiCall 日志
- [ ] 错误已分类（可重试/不可重试）且未吞错
- [ ] 新 API 响应格式符合 envelope 约定
- [ ] Prisma select 仅获取必要字段
- [ ] 后端入口文件正确加载 bootstrap-env

## 测试覆盖

- [ ] 已编写单元测试（目标覆盖率 > 90%）
- [ ] 测试包含正常流程 + 错误边界
- [ ] 外部依赖已 Mock

## 文档

- [ ] 更新了 AGENTS.md（如新增任务类型）
- [ ] 更新了 API 文档（如新增接口）
- [ ] 创建了计划文档（如复杂功能）
```

---

## 快速修复指南

### 发现 `any` 类型？

```typescript
// 1. 使用 unknown + 类型守卫
const data: unknown = JSON.parse(response)
if (isValidProject(data)) {
  // data 现在是 Project 类型
  return data
}

// 2. 使用 Zod 校验（推荐）
const projectSchema = z.object({
  id: z.string(),
  name: z.string()
  // ...
})
const data = projectSchema.parse(JSON.parse(response))

// 3. 如果确实需要 any，添加注释
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Reason: Third-party library returns dynamic shape
const data: any = externalLibrary.getData()
```

### 发现吞错？

```typescript
// ❌ 错误
try {
  await callAPI()
} catch (e) {
  console.log(e)
}

// ✅ 正确
try {
  await callAPI()
} catch (error) {
  logger.error('API call failed', { error, context: 'generate-script' })
  if (isRetryable(error)) {
    throw new RetryableError('Service temporarily unavailable')
  }
  throw new AIGenerationError('Failed to generate script', { cause: error })
}
```

### 发现函数命名不规范？

```typescript
// ❌ 模糊命名
function process(data) { ... }
function handle(req) { ... }
function doThing() { ... }

// ✅ 明确命名
function generatePrompt(scene: Scene): string { ... }
function callDeepSeekAPI(prompt: string): Promise<LLMResponse> { ... }
function buildSeedancePayload(segments: VoiceSegment[]): SeedancePayload { ... }
function createEpisode(projectId: string): Promise<Episode> { ... }
```

---

## ESLint 自动化检查

本项目已配置以下强制规则：

| 规则                                              | 级别      | 说明                        |
| ------------------------------------------------- | --------- | --------------------------- |
| `@typescript-eslint/no-explicit-any`              | **error** | 禁止 any 类型               |
| `no-empty`                                        | **error** | 禁止空 catch 块             |
| `@typescript-eslint/prefer-promise-reject-errors` | **error** | Promise reject 必须传 Error |
| `no-return-await`                                 | **error** | 禁止不必要的 async          |
| `@typescript-eslint/no-non-null-assertion`        | **warn**  | 警告非空断言                |

运行检查：

```bash
# 全仓库检查
pnpm lint

# 仅后端
cd packages/backend && pnpm lint

# 自动修复（部分规则）
pnpm lint --fix
```

---

## 总结

这份规范是从真实踩坑经验中总结的**作战手册**，不是装饰品。

**核心原则**：

1. 类型安全优先（no any）
2. 外部数据必须校验（unknown + Zod）
3. 错误不能吞（分类 + 记录）
4. AI 调用必须可观测（日志 + 审计）
5. 命名必须清晰（动词+名词）

遵守这些规则，AI 生成的代码会明显减少 "any 屎山味"。
