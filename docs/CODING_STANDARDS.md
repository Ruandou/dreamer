# Dreamer 编码规范

**版本**：1.1  
**范围**：本仓库前后端通用原则；后端以 Fastify + Prisma 为准。与 [AGENTS.md](../AGENTS.md) 并行阅读：AGENTS 侧重流程与防踩坑，本文侧重**风格、分层与可维护性**。

---

## 目录

1. [目标与技术栈](#1-目标与技术栈)
2. [目录与分层（模块化）](#2-目录与分层模块化)
3. [命名规范](#3-命名规范)
4. [类型定义](#4-类型定义)
5. [函数设计](#5-函数设计)
6. [错误处理](#6-错误处理)
7. [异步编程](#7-异步编程)
8. [注释](#8-注释)
9. [常量与魔法值](#9-常量与魔法值)
10. [环境变量](#10-环境变量)
11. [日志](#11-日志)
12. [API 响应格式](#12-api-响应格式)
13. [依赖注入与测试](#13-依赖注入与测试)
14. [前端（简要）](#14-前端简要)
15. [代码审查清单](#15-代码审查清单)
16. [Git Commit 规范（建议）](#16-git-commit-规范建议)
17. [Prisma 使用规范（建议）](#17-prisma-使用规范建议)

---

## 1. 目标与技术栈

**目标**：功能高度模块化、**职责单一**、**易于测试与扩展**；代码读起来像文档（**名字即注释**）。

| 常见假设               | Dreamer 实际                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| Express                | **Fastify**（`packages/backend/src/index.ts`）                      |
| `app.ts` 集中配置      | 可在 `index.ts` 或抽 `buildApp.ts` 仅做 `register`                  |
| Prisma 在 `src/prisma` | Schema 在 [`packages/backend/prisma/`](../packages/backend/prisma/) |

可选 HTTP 适配层：`routes/*.ts` 内导出 `xxxRoutes(fastify)`；或增加 `handlers/`，导出接收 `FastifyRequest` / `FastifyReply` 的函数。**不要**按 Express 的 `req/res` 写法硬套。

---

## 2. 目录与分层（模块化）

在**不一次性搬迁全仓库**的前提下，新代码或重构可按以下增量结构：

```text
packages/backend/src/
├── index.ts              # 首行 bootstrap-env（见 AGENTS.md）
├── bootstrap-env.ts
├── routes/               # 路径、method、preHandler，薄
├── handlers/             # 可选：解析请求、调用 service、映射 reply
├── services/             # 业务编排、外部 API、事务边界
│   ├── ai/               # 对外模型 HTTP 与 ModelApiCall（新代码优先从此 import）
│   │   ├── deepseek-client.ts   # DeepSeek OpenAI 兼容 client + 计价
│   │   ├── deepseek.ts          # 剧本/优化/定妆/视觉补全等业务封装
│   │   ├── api-logger.ts        # recordModelApiCall、getApiCalls 等
│   │   ├── model-call-log.ts    # DeepSeek 专用 logDeepSeekChat
│   │   ├── image-generation.ts  # 方舟文生图 / 编辑
│   │   ├── seedance.ts          # 方舟 Seedance 视频
│   │   ├── wan26.ts             # Atlas Wan 2.6
│   │   ├── parser.ts            # 剧本文档解析（DeepSeek）
│   │   ├── model-api-call-service.ts  # 模型调用列表查询
│   │   └── index.ts              # 聚合导出
├── repositories/         # 仅 Prisma 封装，不含跨聚合业务规则
├── lib/                  # 纯函数、无副作用
├── plugins/
├── queues/
└── worker.ts
```

**职责**

- **routes**：注册路由与鉴权；不写复杂业务。
- **handlers（可选）**：解析参数、调用 Service、统一错误响应形状。
- **services**：核心业务；可调用 `repositories` + 外部服务。
- **services/ai/**：集中管理 AI 模型调用、提示词生成、`ModelApiCall` 落库逻辑。`services/*.ts` 根层对部分模块保留 **薄 re-export**（指向 `ai/`），旧 import 仍可用；**新代码请优先** `import … from './ai/xxx.js'` 或经 `services/ai/index.ts`。
- **repositories**：`findById`、`update` 等数据访问；不写业务规则。
- **lib**：工具与纯函数。

**模型调用**：任何 LLM / 文生图等外部模型调用须遵守 AGENTS.md：**`ModelApiCall` 落库**与 **`ModelCallLogContext`**（`userId`、`op`、可选 `projectId`）。

### ⚠️ 禁止直接使用 `fetch()` 调用 LLM API

**关键规则**：项目中**已有完善的 LLM 调用架构**，新代码必须使用标准 wrapper，**不得**直接用 `fetch()` 调用 LLM API。

#### ❌ 错误示例（不要这样做）

```typescript
// 错误：直接 fetch + 检查 Ark API Key
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { arkApiKey: true }
})

if (!user?.arkApiKey) {
  throw new Error('请先在设置中配置方舟 API Key')
}

const response = await fetch(apiUrl, {
  method: 'POST',
  headers: { Authorization: `Bearer ${user.arkApiKey}` },
  body: JSON.stringify({ model: 'deepseek-v3', messages })
})
```

#### ✅ 正确示例

```typescript
import { getDefaultProvider } from '../ai/llm-factory.js'
import { callLLMWithRetry } from '../ai/llm-call-wrapper.js'
import type { LLMMessage } from '../ai/llm-provider.js'

const provider = getDefaultProvider()

const messages: LLMMessage[] = [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: userPrompt }
]

const result = await callLLMWithRetry(
  {
    provider,
    messages,
    temperature: 0.8,
    maxTokens: 4000,
    modelLog: {
      userId,
      op: 'operation_name'
    }
  },
  (content) => JSON.parse(content)
)

return result.content
```

#### 为什么必须用 wrapper？

| 特性          | 直接 `fetch()` | `callLLMWithRetry()` |
| ------------- | -------------- | -------------------- |
| 自动重试      | ❌ 需手写      | ✅ 指数退避          |
| 超时处理      | ❌ 需手写      | ✅ 默认 10 分钟      |
| 错误检测      | ❌ 需手写      | ✅ Auth/RateLimit    |
| 成本计算      | ❌ 需手写      | ✅ 自动计价          |
| 审计日志      | ❌ 需手写      | ✅ 自动落库          |
| Provider 切换 | ❌ 硬编码      | ✅ 接口抽象          |

#### 架构说明

```
services/ai/
├── llm-factory.ts          # getDefaultProvider() - 获取配置的 LLM Provider
├── llm-call-wrapper.ts     # callLLMWithRetry() - 重试 + 日志 + 超时
├── llm-provider.ts         # LLMProvider 接口定义
├── deepseek-provider.ts    # DeepSeek 实现
└── api-logger.ts           # recordModelApiCall() - 仅用于非 LLM 调用
```

**依赖与数据流**：`routes → services → repositories → Prisma`；避免 `services` 再依赖 `routes`。

---

## 3. 命名规范

### 3.1 通用规则

| 规则                          | 示例                        | 说明                     |
| ----------------------------- | --------------------------- | ------------------------ |
| 完整单词，不无故缩写          | `generateImage`             | `genImg` 除非团队共识    |
| 业务术语优先                  | `imagePrompt`、`basePrompt` | 避免无义名如 `promptStr` |
| 布尔：`is` / `has` / `should` | `isSelected`、`hasAvatar`   | 见名知真假               |
| 数组用复数                    | `characters`、`imageUrls`   |                          |
| 常量 `UPPER_SNAKE`            | `MAX_RETRY_COUNT`           | 表示不可变配置           |
| TypeScript `private`          | 优先语言特性                | `_foo` 仅作可选视觉提示  |

### 3.2 函数 / 方法：动词 + 名词

| 前缀                           | 含义                   | 示例                            |
| ------------------------------ | ---------------------- | ------------------------------- |
| `get`                          | 同步、无副作用读取     | `getCharacterById`              |
| `fetch`                        | 异步从外部拉取         | `fetchProjectList`              |
| `find`                         | 查找，可能为 `null`    | `findLocationByName`            |
| `generate`                     | 生成（含 AI）          | `generateLocationImagePrompt`   |
| `generatePrompt`               | 生成给下游模型的提示词 | `generateCharacterOutfitPrompt` |
| `call`                         | 调用外部模型 API       | `callSeedreamGenerate`          |
| `create` / `update` / `delete` | 持久化生命周期         | `updateLocationImageUrl`        |
| `handle`                       | 事件入口               | `handleGenerateClick`           |
| `validate`                     | 校验                   | `validateProjectName`           |
| `build`                        | 组装复杂对象           | `buildSeedanceRequest`          |

### 3.3 类与类型后缀

| 职责          | 后缀                                         | 示例                 |
| ------------- | -------------------------------------------- | -------------------- |
| 业务编排      | `Service`                                    | `LocationService`    |
| 外部 HTTP/SDK | `Client`                                     | `DeepSeekClient`     |
| 数据访问      | `Repository`                                 | `LocationRepository` |
| HTTP 适配     | `Controller` 或 Handler                      | `LocationController` |
| 入参 / 出参   | `Input` / `Response` / `Dto`（团队统一一词） | `GenerateImageInput` |

### 3.4 文件命名

本仓库多为 **kebab-case**（如 `project-script-jobs.ts`、`character-images.ts`）。

- **推荐**：`location-service.ts`、`location-repository.ts`、`deepseek-client.ts`。
- **备选**：`location.service.ts`（点分后缀）— 若采用，**同一目录内**勿与连字符风格混用。
- **不要**为统一风格而批量重命名历史文件（冲突成本高）。

### 3.5 数据库字段（Prisma）

与 **camelCase** 一致；布尔 `is*`；时间 `*At`；外键 `*Id`；避免 SQL 保留字作字段名。

---

## 4. 类型定义

- 默认**不使用 `any`**；若不可避免，**单行注释说明原因**。
- 外部 JSON 使用 **`unknown`** + 类型守卫，或 Zod 等校验。
- 跨前后端类型放在 [`packages/shared`](../packages/shared)；仅后端内部的 DTO 可放在 `src/types/` 或模块旁。
- API 入参与 Fastify **JSON Schema** 或 TypeScript 类型对齐。

---

## 5. 函数设计

- **一事一函数**；约 **50 行**为软上限，复杂分支应更早拆分。
- 参数超过 **3 个**时改用 **对象参数**。
- UI 中保留**编排**（校验 → 调用 API → 更新状态），具体逻辑放入 **composable** / **api** 模块。

---

## 6. 错误处理

- **不要**静默吞错（`catch` 后只 `console.log` 或 `return null` 且无日志与重抛）。
- 除非能**实质处理**（重试、降级），否则记录上下文后 **向上抛出** 或由 Fastify **错误处理器** 统一映射。
- 捕获时记录：**操作名、关键参数、userId/projectId（若有）**；使用 `request.log.error` / `fastify.log.error`，保留 `err` 可追踪。
- 用户可见信息友好；技术细节仅服务端日志。

### 6.1 AI 模型调用错误分类

建议在 Service 层定义专用错误类，便于上层区分处理策略：

```typescript
class AIGenerationError extends Error {
  constructor(
    message: string,
    public readonly model: string,
    public readonly retryable: boolean
  ) {
    super(message)
  }
}
```

- **可重试错误**：超时、限流 → 前端可提示「正在重试」。
- **不可重试错误**：内容安全拦截、参数错误 → 前端提示修改内容。

---

## 7. 异步编程

- 优先 **async/await**，避免深 `.then` 嵌套。
- 无依赖的 IO 使用 **`Promise.all`**；需独立处理失败时用 **`Promise.allSettled`**。

---

## 8. 注释

- 不重复代码已表达的 **what**。
- **why** 必写：临时方案、性能取舍、与外部平台/产品的耦合说明。
- **删除**大段注释掉的死代码（历史由 Git 保留）。

---

## 9. 常量与魔法值

- 状态字符串、重试次数、延迟等用 **`as const` 对象**或枚举，集中在一处（`*.constants.ts` 或模块顶部）。
- 与 Prisma / `packages/shared` **重复**时，以**单一来源**为准，避免多处硬编码。

---

## 10. 环境变量

原则：集中读取、启动期校验、避免散落 `process.env`。

**必须与 AGENTS.md 一致**：ESM 下须保证 **`import './bootstrap-env.js'`** 在任何读取业务相关 `process.env` 的模块之前执行（`index.ts`、`worker.ts` 第一行）。

若新增 `config/env.ts`：

- 须在 **bootstrap 之后** 由入口或 composition root 引用；
- **避免**被深层模块静态 import 导致早于 `dotenv`。

可选：`bootstrap-env.ts` 末尾调用 `validateRequiredEnv()`。

---

## 11. 日志

- 优先 **`fastify.log` / `request.log`（Pino）**；需要时用 **child logger** 带 `reqId`、`userId`。
- **error** 级须能还原堆栈；**禁止**打印密码、Token、完整 `Authorization`。
- 模型调用终端约定见 AGENTS：`[model-api] ...`。

### 11.1 模型调用日志最小字段集

为便于成本分析与质量追踪，约定模型调用日志应包含以下字段（与 `ModelApiCall` 表对齐）：

```typescript
request.log.info(
  {
    op: 'seedream.generate',
    model: 'doubao-seedream-5-0-lite',
    projectId,
    locationId,
    promptLength: prompt.length,
    cost: 0.035,
    durationMs
  },
  'Seedream image generated'
)
```

不推荐另起一套仅 `console.log` 的全局 logger，除非是对 Pino 的薄封装且行为一致。

---

## 12. API 响应格式

**现状**：部分接口直接返回资源或 `{ error: string }` + HTTP 状态码，并非全部为 envelope。

**约定**：

- **新 API 或重大改版**：可采用 `{ success, data, message }` / `{ success: false, error, message }`，业务错误码用**常量**定义。
- **现有 API**：不强制一次性改造；改动需评估前端与测试。
- **REST**：仍应正确使用 **HTTP 状态码**（4xx/5xx）；避免滥用「200 + `success: false`」（若团队禁止需明确写入本规范修订）。

---

## 13. 依赖注入与测试

- 在 **`index.ts`** 或 **`container.ts`** 组装 `Repository` / `Service`；可用 **`fastify.decorate`** 或模块闭包注入。
- **渐进**替换 `import { prisma } from '../index.js'`，避免巨型单 PR。
- 测试使用 **Vitest**；Mock **注入的依赖**，避免默认全局 mock 整个 `@prisma/client`（集成测除外）。

---

## 14. 前端（简要）

- 页面：`packages/frontend/src/views/`；状态：`stores/`；复用逻辑：`composables/`；HTTP：`api/index.ts`。
- 命名原则与后端一致：完整词、动词短语、避免无理由 `any`。
- 与后端共享类型优先来自 **`packages/shared`**。

### 14.1 AI 生成任务的状态管理约定

前端涉及大量异步生成任务（生成提示词、生成图片、轮询状态），约定：

- 生成任务状态统一使用 **`'idle' | 'loading' | 'success' | 'error'`**。
- 轮询逻辑封装在 **`composables/usePolling.ts`**（或项目内等价 composable）中，避免散落在各组件。

---

## 15. 代码审查清单

| 检查项   | 说明                                 |
| -------- | ------------------------------------ |
| 命名     | 变量/函数是否自解释                  |
| 单一职责 | 函数是否过长、是否做多件事           |
| 类型     | 是否避免无理由 `any`                 |
| 错误     | 是否吞错；日志是否有上下文           |
| 魔法值   | 是否提取常量                         |
| 注释     | 是否解释 why；无大块死代码           |
| 日志     | 关键路径是否可排障；是否泄露敏感信息 |
| 异步     | 可并行是否使用 `Promise.all`         |
| 可观测性 | 模型调用是否仍满足 AGENTS.md         |

---

## 16. Git Commit 规范（建议）

采用[约定式提交](https://www.conventionalcommits.org/)（Conventional Commits），便于生成 Changelog 和语义化版本。

| 前缀       | 说明                   | 示例                                   |
| ---------- | ---------------------- | -------------------------------------- |
| `feat`     | 新功能                 | `feat: 添加场景图一键生成接口`         |
| `fix`      | Bug 修复               | `fix: 修复角色形象提示词未保存问题`    |
| `refactor` | 重构（不改变功能）     | `refactor: 将提示词生成抽离为独立服务` |
| `docs`     | 文档更新               | `docs: 更新编码规范至 v1.1`            |
| `style`    | 代码格式（不影响逻辑） | `style: 统一缩进`                      |
| `test`     | 测试相关               | `test: 补充图片生成服务的单元测试`     |
| `chore`    | 构建/工具/依赖         | `chore: 升级 Prisma 至 5.x`            |

---

## 17. Prisma 使用规范（建议）

- **查询优化**：使用 `select` 代替过宽的 `include`，仅返回前端需要的字段，减少数据传输。
- **批量操作**：优先使用 `createMany`、`updateMany`、`deleteMany`。
- **事务**：涉及多表写操作时使用 `prisma.$transaction`。
- **避免循环查询**：禁止在 `for` 循环中 `await prisma.xxx`，应使用 `Promise.all` 或批量查询。
- **敏感字段**：查询用户等实体时**不要**在 `select` / `include` 中带出 `password` 等敏感列；用显式字段列表或 DTO 映射，避免整模型泄露。

---

## 文档维护

修订本文件时同步更新**版本号**与修订说明（可放在 Git commit 或 PR 描述中）。若与 AGENTS.md 冲突，**以 AGENTS.md 的流程与安全规则为准**，并在此文档或 PR 中说明差异与迁移计划。

### 修订记录

| 版本 | 日期       | 说明                                                                                                                             |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1.0  | —          | 初始版本                                                                                                                         |
| 1.1  | 2026-04-14 | 新增 AI 服务子目录、命名前缀（含 `generatePrompt` / `call`）、错误分类、日志字段、前端状态约定、Git Commit 规范、Prisma 使用规范 |
