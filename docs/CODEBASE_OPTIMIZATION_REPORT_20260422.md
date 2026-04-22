# 代码库优化报告 2026-04-22

## 概述

本次优化覆盖安全、性能、日志、数据库索引四大维度，共计 14 项改动，全部通过 1362 个测试用例验证。

---

## 一、安全修复（5 项）

### 1. FFmpeg 字幕路径命令注入（CRITICAL）

**文件**: `packages/backend/src/services/ffmpeg.ts`

**问题**: 字幕路径直接拼入 FFmpeg filter 字符串，可构造特殊路径注入命令。

```typescript
// 修复前
;`subtitles='${subtitlePath}'`

// 修复后
function escapeSubtitlePath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, '/')
  return normalized.replace(/'/g, "'\\''")
}
;`subtitles='${escapeSubtitlePath(subtitlePath)}'`
```

### 2. API Key 明文返回（HIGH）

**文件**: `packages/backend/src/services/settings-service.ts`

**问题**: `/api/settings/me` 返回 `atlasApiKey`、`arkApiKey` 等明文。

**修复**: 改为布尔标记 `hasAtlasApiKey`、`hasArkApiKey` 等，不暴露实际密钥值。

### 3. CORS 默认通配符（HIGH）

**文件**: `packages/backend/src/index.ts`

**问题**: `CORS_ORIGIN` 未设置时使用 `true`，允许任意域名。

**修复**: 生产环境（`NODE_ENV=production`）未设置 `CORS_ORIGIN` 时 CORS origin 设为 `false`（拒绝跨域），并输出警告日志。

### 4. 默认 JWT Secret（HIGH）

**文件**: `packages/backend/src/index.ts`

**问题**: `JWT_SECRET` 未设置时使用硬编码 `'your-super-secret-jwt-key'`。

**修复**: 生产环境未设置 `JWT_SECRET` 时启动抛出异常，强制要求配置。开发环境使用 `'dev-only-not-for-production'`。

### 5. process.env 竞态（MEDIUM）

**文件**: `packages/backend/src/services/settings-service.ts`、`packages/backend/src/services/ai/deepseek-balance.ts`

**问题**: `getDeepSeekBalance()` 读取全局 `process.env.DEEPSEEK_API_KEY`，`settingsService` 通过临时修改全局变量传入用户密钥，并发请求互相干扰。

**修复**: `getDeepSeekBalance(apiKey?: string)` 接受可选参数，直接传入 API Key 而非修改全局环境变量。

---

## 二、性能修复（3 项）

### 1. 分页未生效（HIGH）

**文件**: `packages/backend/src/routes/memories.ts`、`packages/backend/src/repositories/memory-repository.ts`

**问题**: 记忆列表 API 接收 `limit/offset` 查询参数但**完全未使用**，始终返回全部记录。

**修复**:

- Repository `findByProject` 增加 `take`/`skip`，默认 limit 500、上限 500
- Route 解析 `limit`（默认 50，上限 500）、`offset`（默认 0）并传递给 service
- `minImportance` 增加范围校验（1-5）
- 搜索接口 limit 上限 100

### 2. Limit 无上限校验（HIGH）

**文件**: `packages/backend/src/routes/tasks-unified.ts`

**问题**: `limit` 默认 200 但无上限，可传入任意大值。

**修复**: `limit = Math.min(Math.max(1, rawLimit), 1000)`，`offset = Math.max(0, rawOffset)`。

### 3. N+1 查询优化（MEDIUM）

**文件**: `packages/backend/src/repositories/stats-repository.ts`、`packages/backend/src/services/stats-service.ts`

**问题**: `findProjectForCostStats` 加载 `project → episodes → scenes → takes` 整棵树，一个项目可能产生上万条记录。

**修复**:

- 改为直接查询 `prisma.Take.findMany` + `prisma.ImportTask.findMany`
- 用户维度统计使用单次批量查询 + 内存分组
- 返回类型从嵌套对象改为扁平 `ProjectCostData` 接口
- Service 层适配新返回结构

---

## 三、日志规范化（2 项）

### 1. 后端 console.\* 替换

**涉及文件**:

| 文件                                  | 替换数 |
| ------------------------------------- | ------ |
| `queues/video.ts`                     | 8 处   |
| `queues/pipeline.ts`                  | 5 处   |
| `queues/import.ts`                    | 5 处   |
| `queues/image.ts`                     | 3 处   |
| `routes/settings.ts`                  | 1 处   |
| `routes/memories.ts`                  | 1 处   |
| `repositories/pipeline-repository.ts` | 1 处   |

全部替换为 `logInfo()`、`logError()`、`logWarning()`（来自 `lib/error-logger.js`），附带结构化上下文。

### 2. 前端 console.\* 规范化

**涉及文件**:

| 文件                                               | 改动                                |
| -------------------------------------------------- | ----------------------------------- |
| `composables/useSSE.ts`                            | 移除 3 处调试日志                   |
| `views/Stats.vue`                                  | 添加模块前缀 `[Stats]`              |
| `views/Jobs.vue`                                   | 添加模块前缀 `[Jobs]`               |
| `views/ProjectScript.vue`                          | 添加模块前缀 `[ProjectScript]`      |
| `components/storyboard/StoryboardScriptEditor.vue` | 添加模块前缀                        |
| `lib/project-sse-bridge.ts`                        | 添加模块前缀 `[project-sse-bridge]` |

---

## 四、数据库索引（1 项）

**文件**: `packages/backend/prisma/schema.prisma`

| 表              | 变更                                                     | 原因                                |
| --------------- | -------------------------------------------------------- | ----------------------------------- |
| `SceneDialogue` | `@@index([sceneId])` → `@@index([sceneId, startTimeMs])` | 对话时间线查询常按 scene + 时间排序 |
| `MemoryItem`    | 新增 `@@index([projectId, episodeId, type])`             | 分集记忆查询过滤条件                |

---

## 五、测试

| 指标            | 值     |
| --------------- | ------ |
| 测试文件        | 132    |
| 测试用例        | 1362   |
| 通过率          | 100%   |
| TypeScript 编译 | 0 错误 |
| ESLint          | 0 错误 |

### 测试适配

以下测试文件因 API 变更同步更新：

- `tests/stats.test.ts` — mock 从嵌套结构改为扁平查询
- `tests/settings.test.ts` — 断言从 `apiKeys.deepseekApiUrl` 改为 `apiKeys.hasDeepseekApiUrl`
