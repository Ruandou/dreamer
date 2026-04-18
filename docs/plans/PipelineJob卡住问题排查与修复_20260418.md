# Pipeline Job 卡住问题全面排查与修复计划

## 问题现状

最近频繁出现Pipeline Job卡住在running状态的问题：

- `cmo478djm000196orr0a8mj4z` - 卡在outline-generation (5%) 超过10分钟
- `cmo3wghs20003sdetwfx7813x` - 卡在script-first (5%)
- `cmo3u6aga00aruvzxr7w2exes` - 卡在showrunner-review (15%)

## 根本原因分析

### 🔴 严重问题1：缺少整体超时保护

**位置**: `generateAllOutlines()` (project-script-jobs.ts:254-309)

**问题**:

- 36集大纲生成，5并发 = 8批
- 单集超时10分钟 × 2次重试 = 最多20分钟/集
- **整体函数没有超时**，理论上可能卡住2-3小时
- 期间progress一直是5%，无任何进度更新

**影响**: 用户看到任务"卡住"，实际可能在长时间运行

### 🔴 严重问题2：长时间操作无进度更新

**位置**:

1. `generateAllOutlines()` - 整个函数执行期间无进度更新
2. `showrunnerReviewOutlines()` - 审核多集大纲时无进度
3. `applyScriptVisualEnrichment()` - 视觉补全可能很慢

**问题**: 用户无法知道任务是否还在运行

### 🟡 中等问题3：重试策略不合理

**位置**: `generateAllOutlines()` 内部

**问题**:

- MAX_RETRIES = 2，但每次失败后只等待1-2秒
- 没有退避策略（exponential backoff）
- 可能反复触发相同的错误

### 🟡 中等问题4：并发控制不够智能

**位置**: `generateAllOutlines(concurrency: 5)`

**问题**:

- 固定5并发，不考虑API限流
- DeepSeek可能有RPM/TPM限制
- 大量并发可能触发429错误

### 🟢 轻微问题5：错误日志不够详细

**位置**: 多个catch块

**问题**:

- 缺少jobId、projectId等上下文
- 难以从日志追踪问题

## 修复方案

### Phase 1: 添加整体超时保护（紧急）

**文件**: `packages/backend/src/services/project-script-jobs.ts`

```typescript
// 在 runScriptBatchJob 的 outline-generation 阶段添加超时
const OUTLINE_GENERATION_TIMEOUT_MS = 30 * 60 * 1000 // 30分钟

await Promise.race([
  generateAllOutlines(projectId, targetEpisodes, project.name, synopsis, 5, modelLogCtx),
  new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`大纲生成超时（${OUTLINE_GENERATION_TIMEOUT_MS / 1000 / 60}分钟）`)),
      OUTLINE_GENERATION_TIMEOUT_MS
    )
  )
])
```

**同样应用到**:

- `showrunnerReviewOutlines()` - 15分钟超时
- `applyScriptVisualEnrichment()` - 20分钟超时

### Phase 2: 添加阶段性进度更新

**文件**: `project-script-jobs.ts`

```typescript
async function generateAllOutlines(...) {
  const outlines = new Map<number, string>()
  const totalBatches = Math.ceil(targetEpisodes / concurrency)
  let completedBatches = 0

  for (let batchStart = 1; batchStart <= targetEpisodes; batchStart += concurrency) {
    const batchEnd = Math.min(batchStart + concurrency - 1, targetEpisodes)

    // 更新进度
    completedBatches++
    const batchProgress = Math.round((completedBatches / totalBatches) * 100)
    console.log(`[outline-generation] 批次 ${completedBatches}/${totalBatches} (${batchProgress}%)`)

    await Promise.all(...)
  }

  return outlines
}
```

### Phase 3: 改进重试策略

```typescript
const MAX_RETRIES = 2
const BASE_DELAY_MS = 2000

// 指数退避
const delay = BASE_DELAY_MS * Math.pow(2, retries - 1)
await new Promise((resolve) => setTimeout(resolve, delay))
```

### Phase 4: 添加并发限流保护

```typescript
// 使用 p-limit 或自定义信号量
import pLimit from 'p-limit'
const limit = pLimit(3) // 最多3个并发

await Promise.all(episodes.map((ep) => limit(() => generateEpisode(ep))))
```

### Phase 5: 增强错误日志

```typescript
catch (error) {
  console.error('[outline-generation] 任务失败:', {
    jobId,
    projectId,
    episodeNum: epNum,
    attempt: retries,
    error: error.message,
    stack: error.stack
  })
}
```

## 立即行动

### 1. 清理卡住的任务

```sql
UPDATE "PipelineJob"
SET status = 'failed',
    error = '任务超时，自动标记为失败',
    "updatedAt" = NOW()
WHERE status = 'running'
  AND "updatedAt" < NOW() - INTERVAL '15 minutes';
```

### 2. 重启后端

```bash
lsof -ti:4000 | xargs kill -9
pnpm dev:backend
```

### 3. 实施Phase 1修复（今天）

优先添加超时保护，防止新问题出现。

### 4. 实施Phase 2-5（本周）

逐步改进进度更新、重试策略等。

## 测试验证

1. **单元测试**: 模拟超时场景
2. **集成测试**: 生成36集大纲，验证不会卡住
3. **压力测试**: 并发5个任务，验证限流有效

## 预期效果

- ✅ 任务最长运行时间 < 30分钟
- ✅ 每5分钟至少有进度更新
- ✅ 失败任务立即标记，不会卡住
- ✅ 用户可以清楚看到任务进度
- ✅ 错误日志包含完整上下文

## 风险评估

- **低风险**: 添加超时保护（Phase 1）
- **中风险**: 修改重试策略（需要测试）
- **高风险**: 引入p-limit库（需要评估依赖）

建议先实施Phase 1-2，观察效果后再决定是否实施Phase 4。
