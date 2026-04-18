# 任务系统架构文档

## 概述

Dreamer系统使用**双轨任务架构**：

- **PipelineJob**（数据库存储）- 管理核心业务流程
- **BullMQ队列**（Redis存储）- 管理底层技术操作

---

## 一、PipelineJob（数据库任务）

### 1.1 存储位置

- **数据库**: PostgreSQL
- **表名**: `PipelineJob`
- **持久化**: 永久保存，重启不丢失

### 1.2 数据结构

```typescript
interface PipelineJob {
  id: string // 任务ID
  projectId: string // 关联项目
  projectName: string // 项目名称（冗余字段）
  userId: string // 用户ID
  jobType: string // 任务类型
  status: 'running' | 'completed' | 'failed'
  currentStep: string // 当前执行步骤
  progress: number // 进度 0-100
  progressMeta: JSON // 进度详情
  error: string | null // 错误信息
  createdAt: Date
  updatedAt: Date
}
```

### 1.3 任务类型

| 类型代码                    | 前端显示   | 作用                   | 触发方式               | 典型耗时  |
| --------------------------- | ---------- | ---------------------- | ---------------------- | --------- |
| `script-first`              | 生成第一集 | AI生成第1集剧本        | 用户输入创意           | 5-10分钟  |
| `script-batch`              | 批量剧本   | AI生成第2-36集         | script-first成功后自动 | 30-60分钟 |
| `parse-script`              | 解析剧本   | 解析用户上传的完整剧本 | 用户上传剧本           | 20-40分钟 |
| `episode-storyboard-script` | 分镜剧本   | 生成单集分镜脚本       | 用户点击分镜生成       | 3-5分钟   |
| `full-pipeline`             | 完整流水线 | 完整流水线（未使用）   | -                      | -         |

### 1.4 任务流程

#### script-first（生成第一集）

```
用户输入创意
  ↓
创建PipelineJob (jobType=script-first, progress=5%)
  ↓
setImmediate异步执行
  ↓
调用AI生成第1集剧本
  ↓
更新Job状态 (completed/failed)
```

#### script-batch（批量生成）

```
script-first完成
  ↓
创建PipelineJob (jobType=script-batch, progress=0%)
  ↓
阶段1: 大纲生成 (progress: 5-28%)
  ├─ 5并发生成所有集大纲
  ├─ 每集10分钟超时
  └─ 最多重试2次
  ↓
阶段2: 总编剧审核 (progress: 28-35%)
  ├─ AI审核大纲一致性
  ├─ 最多2轮修正
  └─ 审核不通过则重新生成
  ↓
阶段3: 逐集生成 (progress: 35-95%)
  ├─ 串行生成（保证连贯性）
  ├─ 每集提取记忆
  └─ 更新进度
  ↓
完成 (progress: 100%)
```

#### parse-script（解析剧本）

```
用户上传完整剧本
  ↓
创建PipelineJob (jobType=parse-script, progress=0%)
  ↓
智能模式检测
  ├─ faithful-parse（忠实解析）- 完整剧本
  ├─ mixed（混合模式）- 部分剧本
  └─ ai-create（AI创作）- 只有大纲
  ↓
阶段1: 大纲生成/提取 (progress: 5-15%)
  ↓
阶段2: 总编剧审核 (progress: 15-20%)
  ↓
阶段3: 逐集生成/解析 (progress: 20-80%)
  ↓
阶段4: 视觉补全 (progress: 80-95%)
  ├─ 自动生成visualStyleConfig
  ├─ 提取角色/场地
  └─ 生成imagePrompt
  ↓
完成 (progress: 100%)
```

#### episode-storyboard-script（分镜剧本）

```
用户选择单集
  ↓
创建PipelineJob (jobType=episode-storyboard-script)
  ↓
解析剧本文字
  ↓
生成场景 (Scene)
  ↓
生成分镜 (Shot)
  ↓
完成
```

### 1.5 执行机制

```typescript
// 创建任务
const job = await pipelineRepository.createJob({
  jobType: 'parse-script',
  status: 'running',
  progress: 0,
  currentStep: 'initializing'
})

// 异步执行（不阻塞API响应）
setImmediate(async () => {
  try {
    await runParseScriptJob(job.id, projectId, targetEpisodes)
  } catch (err) {
    // 确保错误状态写入数据库
    await pipelineRepository.updateJob(job.id, {
      status: 'failed',
      error: err.message
    })
  }
})

// 返回jobId给前端
return { jobId: job.id }
```

### 1.6 当前问题

#### 🔴 严重：任务卡住

**现象**：

- 3个任务卡在running状态超过3小时
- progress停留在5%或15%
- updatedAt不更新

**原因**：

1. `generateAllOutlines()` 函数中某个Promise永远pending
2. 没有整体超时保护
3. 异常没有正确传播到外层catch

**受影响任务**：

- `cmo478djm` - parse-script，卡在outline-generation（3小时）
- `cmo3wghs` - script-first，卡在script-first（8小时）
- `cmo3u6aga` - parse-script，卡在showrunner-review（9小时）

#### 🟡 中等：缺少进度更新

**现象**：

- `generateAllOutlines()` 执行期间progress一直是5%
- 用户无法区分"正在运行"还是"已卡住"

**影响**：用户体验差，无法判断任务状态

#### 🟡 中等：重试策略不合理

**现象**：

- 固定延迟重试（1秒、2秒）
- 没有指数退避
- 可能反复触发相同错误

---

## 二、BullMQ队列任务（Redis）

### 2.1 存储位置

- **队列**: Redis
- **库**: BullMQ
- **持久化**: 可选（默认易失）

### 2.2 队列类型

| 队列名                 | 作用                  | 消费者    | 典型耗时   |
| ---------------------- | --------------------- | --------- | ---------- |
| `videoQueue`           | 视频生成              | worker.ts | 1-5分钟    |
| `importQueue`          | 剧本导入              | worker.ts | 30秒-2分钟 |
| `imageGenerationQueue` | 图片生成（定妆/定场） | worker.ts | 10-30秒    |

### 2.3 任务特性

```typescript
// 添加任务到队列
await videoQueue.add('generate', {
  episodeId: 'ep1',
  scenes: [...],
  aspectRatio: '9:16'
}, {
  attempts: 3,              // 自动重试3次
  backoff: {                // 指数退避
    type: 'exponential',
    delay: 5000            // 初始延迟5秒
  },
  timeout: 300000           // 5分钟超时
})
```

### 2.4 优势

- ✅ 自动重试 + 退避策略
- ✅ 内置超时保护
- ✅ 并发控制（limit）
- ✅ 优先级队列
- ✅ 延迟执行
- ✅ Worker模式（独立进程）

### 2.5 劣势

- ❌ 查询困难（不能SQL）
- ❌ 与业务数据关联弱
- ❌ Redis重启可能丢失
- ❌ 不适合长时间任务

---

## 三、双轨架构对比

| 维度         | PipelineJob  | BullMQ            |
| ------------ | ------------ | ----------------- |
| **存储**     | PostgreSQL   | Redis             |
| **持久性**   | 永久         | 可选（默认易失）  |
| **查询**     | SQL灵活查询  | 只能按队列/状态查 |
| **重试**     | ❌ 手动      | ✅ 自动           |
| **超时**     | ❌ 手动      | ✅ 内置           |
| **并发**     | ❌ 手动      | ✅ 自动限流       |
| **优先级**   | ❌ 无        | ✅ 支持           |
| **延迟执行** | ❌ 无        | ✅ 支持           |
| **进度追踪** | ✅ 详细      | ⚠️ 简单           |
| **业务关联** | ✅ 强        | ⚠️ 弱             |
| **典型耗时** | 分钟~小时    | 秒~分钟           |
| **监控**     | 前端任务中心 | BullMQ Dashboard  |

---

## 四、为什么这样设计？

### PipelineJob - 核心业务流程

```
用户上传剧本（业务操作）
  ↓
创建PipelineJob（记录业务状态）
  ↓
异步执行：大纲→审核→生成→补全（多步骤流程）
  ↓
用户随时查看进度（需要持久化）
```

**设计理由**：

1. 需要持久化状态（用户刷新页面仍能看到）
2. 需要详细进度追踪（用户等待体验）
3. 需要关联业务数据（project、episode）
4. 需要可查询、可统计

### BullMQ - 底层技术操作

```
生成视频（技术操作）
  ↓
加入Redis队列（异步处理）
  ↓
Worker消费（自动重试+限流）
  ↓
完成回调（更新数据库）
```

**设计理由**：

1. 需要自动重试（视频生成可能失败）
2. 需要限流（API调用频率限制）
3. 需要超时保护（防止卡住）
4. 独立于业务流程

---

## 五、任务状态机

### PipelineJob状态流转

```
创建 (running, progress=0%)
  ↓
执行中 (running, progress=0-99%)
  ├─ 更新currentStep
  ├─ 更新progress
  └─ 更新progressMeta
  ↓
完成 (completed, progress=100%)
或
失败 (failed, error="错误信息")
```

### 异常处理

```typescript
try {
  await runJob(jobId, ...)
} catch (error) {
  // 1. 更新Job状态为failed
  await updateJob(jobId, {
    status: 'failed',
    error: error.message
  })

  // 2. 重新抛出（让setImmediate的catch再次捕获）
  throw error
}
```

**注意**：必须同时更新数据库 + re-throw，否则任务会卡在running状态！

---

## 六、前端集成

### 6.1 任务中心（Jobs.vue）

```typescript
// 获取所有PipelineJob
const pipelineJobs = await fetch('/api/pipeline/jobs')

// 映射jobType为中文
function pipelineSubtypeLabel(jobType: string): string {
  const labels = {
    'script-first': '生成第一集',
    'script-batch': '批量剧本',
    'parse-script': '解析剧本',
    'episode-storyboard-script': '分镜剧本',
    'full-pipeline': '完整流水线'
  }
  return labels[jobType] || 'Pipeline'
}
```

### 6.2 进度轮询

```typescript
// 每5秒轮询一次任务状态
setInterval(async () => {
  const jobs = await fetch('/api/pipeline/jobs')
  jobs.forEach((job) => {
    if (job.status === 'running') {
      updateProgress(job.id, job.progress)
    }
  })
}, 5000)
```

---

## 七、监控与排查

### 7.1 查看任务列表

```bash
curl http://localhost:4000/api/pipeline/jobs \
  -H 'Authorization: Bearer <token>'
```

### 7.2 查看模型调用

```bash
curl http://localhost:4000/api/model-api-calls?limit=50 \
  -H 'Authorization: Bearer <token>'
```

### 7.3 排查卡住的任务

```sql
-- 查找超过15分钟未更新的任务
SELECT id, "jobType", status, progress, "currentStep", "updatedAt"
FROM "PipelineJob"
WHERE status = 'running'
  AND "updatedAt" < NOW() - INTERVAL '15 minutes';
```

### 7.4 手动标记失败

```sql
UPDATE "PipelineJob"
SET status = 'failed',
    error = '任务超时，手动标记为失败',
    "updatedAt" = NOW()
WHERE status = 'running'
  AND "updatedAt" < NOW() - INTERVAL '15 minutes';
```

---

## 八、待修复问题

### 紧急（P0）

#### 1. 添加整体超时保护

**位置**: `project-script-jobs.ts`

```typescript
// generateAllOutlines 添加30分钟超时
const OUTLINE_TIMEOUT = 30 * 60 * 1000
await Promise.race([
  generateAllOutlines(...),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('大纲生成超时')), OUTLINE_TIMEOUT)
  )
])
```

**同样应用到**：

- `showrunnerReviewOutlines()` - 15分钟
- `applyScriptVisualEnrichment()` - 20分钟

#### 2. 添加阶段性进度更新

**位置**: `generateAllOutlines()` 内部

```typescript
for (let batchStart = 1; batchStart <= targetEpisodes; batchStart += concurrency) {
  // 每批完成后更新进度
  const batchProgress = Math.round((batchStart / targetEpisodes) * 100)
  await updateJob(jobId, { progress: 5 + Math.round(batchProgress * 0.2) })
}
```

### 重要（P1）

#### 3. 改进重试策略

```typescript
// 指数退避
const delay = 2000 * Math.pow(2, retries - 1)
await new Promise((resolve) => setTimeout(resolve, delay))
```

#### 4. 增强错误日志

```typescript
catch (error) {
  console.error('[outline-generation] 任务失败:', {
    jobId,
    projectId,
    episodeNum: epNum,
    attempt: retries,
    error: error.message
  })
}
```

### 建议（P2）

#### 5. 考虑迁移到BullMQ

**优点**：

- 自动重试 + 超时
- 并发控制
- 更好的监控

**缺点**：

- 迁移成本高
- 失去SQL查询能力
- 需要改造前端

**建议**：暂不迁移，先完善PipelineJob的超时保护

---

## 九、最佳实践

### 创建PipelineJob

1. 立即设置 `status='running', progress=0`
2. 使用 `setImmediate` 异步执行
3. 每个阶段更新 `currentStep` 和 `progress`
4. catch块必须：updateJob(failed) + throw

### 执行长时间操作

1. 添加整体超时（Promise.race）
2. 阶段性更新进度
3. 记录详细日志（jobId、projectId）
4. 失败时更新数据库状态

### 前端轮询

1. 每5秒轮询一次
2. 显示进度条 + 当前步骤
3. 超时任务标红显示
4. 提供"重试"按钮

---

## 十、附录

### A. 相关文件

| 文件                                           | 作用                |
| ---------------------------------------------- | ------------------- |
| `src/services/project-script-jobs.ts`          | PipelineJob执行逻辑 |
| `src/services/project-service.ts`              | 创建PipelineJob     |
| `src/repositories/pipeline-repository.ts`      | 数据库操作          |
| `src/services/episode-storyboard-job.ts`       | 分镜任务            |
| `src/queues/import.ts`                         | 导入队列            |
| `src/services/image-generation-job-service.ts` | 图片生成队列        |

### B. 环境变量

```bash
# PostgreSQL（PipelineJob存储）
DATABASE_URL=postgresql://...

# Redis（BullMQ队列）
REDIS_URL=redis://localhost:6379
```

### C. 启动命令

```bash
# 后端（包含PipelineJob处理）
pnpm dev:backend

# Worker（处理BullMQ队列）
pnpm dev:worker
```

---

**文档版本**: v1.0  
**最后更新**: 2026-04-18  
**维护者**: Development Team
