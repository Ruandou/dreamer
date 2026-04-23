# AI短剧工作台 - 开发规则

**编码风格与分层约定**（命名、模块化、错误处理、日志等）见 [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)。

## 环境变量加载

**关键规则**：在 ESM 里，**所有** `import` 会先完成依赖解析；若写成「先 `config()` 再 `import` 业务路由」，路由链里的模块仍可能在 `dotenv` 之前执行，导致 `process.env.ARK_*` 等读为空。

### 正确做法

`packages/backend/src/bootstrap-env.ts` 内只做 `dotenv.config`（路径用 `import.meta.url` 指向**仓库根** `.env`）。**`index.ts` 与 `worker.ts` 的第一行**必须是：

```typescript
import './bootstrap-env.js'
```

然后再 `import Fastify` / 路由 / `PrismaClient` 等。

### 禁止

```typescript
// 错误：其它 import 仍可能先于 config() 执行（ESM 提升 / 依赖顺序）
import { config } from 'dotenv'
config({ path: '../../.env' })
import Fastify from 'fastify' // 若 Fastify 之前的路由链已读 env，仍可能踩坑

// 错误！PrismaClient 在 dotenv 之前被初始化
import { PrismaClient } from '@prisma/client' // ❌
import 'dotenv/config' // 太晚了
```

### 防回归（避免反复踩坑）

| 场景                          | 做法                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 新增后端入口（脚本 / 子进程） | 第一行 `import './bootstrap-env.js'`（路径相对该入口），或 `node --import ./dist/bootstrap-env.js …`                                                                                                         |
| 改 `index.ts` / `worker.ts`   | **禁止**在 `import './bootstrap-env.js'` 之上再加任何会加载业务代码的 `import`                                                                                                                               |
| 单测只 `import` 某个 service  | 已在 `vitest.config.ts` 里 `setupFiles: ['./src/bootstrap-env.ts']`，一般无需再抄                                                                                                                            |
| 生产 `pnpm start`             | `package.json` 已用 `node --import ./dist/bootstrap-env.js`，勿删                                                                                                                                            |
| 方舟图片成本展示              | 从 `images/generations` 的 `usage` 取 token，按 `ARK_IMAGE_YUAN_PER_MILLION_TOKENS`（默认 `4`，即每百万 token 约 4 元）估算后写入 `CharacterImage.imageCost` / `Location.imageCost`；可按控制台账单改 `.env` |

## 模型调用可观测性

- **规则**：新增或修改任何对外部模型（LLM / 文生图 / 视频等）的调用时，必须**同时**：(1) 落库 `ModelApiCall`（`recordModelApiCall`、`logApiCall`、或 DeepSeek 路径的 `logDeepSeekChat`）；(2) 在业务侧传入 `ModelCallLogContext`（`userId`、`op`、可选 `projectId`），便于审计与排障。
- **查询**：`GET /api/model-api-calls`（需登录，`limit` / `offset` / `model` 查询参数）返回当前用户的调用记录。
- **终端**：`recordModelApiCall` 会输出一行 `[model-api] <provider> <model> <status> op=<op>`。

### ⚠️ LLM 调用必须使用标准 Wrapper

**禁止**在新增代码中使用 `fetch()` 直接调用 LLM API。必须使用：

```typescript
import { getDefaultProvider } from './services/ai/llm-factory.js'
import { callLLMWithRetry } from './services/ai/llm-call-wrapper.js'

const provider = getDefaultProvider()
const result = await callLLMWithRetry({
  provider,
  messages: [...],
  modelLog: { userId, op: 'xxx' }
}, (content) => JSON.parse(content))
```

**详见**：[docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) 第 2 节「禁止直接使用 fetch() 调用 LLM API」

## 启动命令

后端必须在项目根目录运行：

```bash
cd /Users/leifu/Learn/dreamer
pnpm dev:backend
```

前端同理：

```bash
cd /Users/leifu/Learn/dreamer
pnpm dev:frontend
```

## Prisma 数据库

确保 PostgreSQL 已启动后再操作数据库：

```bash
pnpm docker:up    # 启动数据库
pnpm db:push      # 同步 schema（只做增量更新）
```

### ⚠️ 禁止使用 --force-reset

`prisma db push --force-reset` 会**删除整个数据库**，所有数据都会丢失！

- 只用 `pnpm db:push` 进行增量同步
- 如果需要添加新字段，先备份数据
- 绝对不要在生产环境使用 `--force-reset`

## 测试要求

### 测试覆盖率目标

在实现功能时，**必须同步编写测试用例**，目标覆盖率：**90%以上**。

### 后端测试规范

1. **测试文件位置**: `packages/backend/tests/`
2. **测试框架**: Vitest + @vitest/coverage-v8
3. **运行测试**:
   ```bash
   cd packages/backend
   pnpm test --run           # 运行所有测试
   pnpm test --run --coverage  # 带覆盖率报告
   ```

### 前端测试规范

1. **测试文件位置**: `packages/frontend/src/**` 内 `*.test.ts`（与实现同目录或就近）
2. **测试框架**: Vitest（`packages/frontend/vitest.config.ts`）
3. **运行测试**:
   ```bash
   cd packages/frontend
   pnpm test              # 全量（vitest run）
   pnpm test:watch        # 监听模式
   ```
4. **全仓库一键**（根目录）: `pnpm test` → 先后端 `vitest run` 再前端 `vitest run`

### 编写测试的要求

1. **路由测试** (`*.test.ts`):
   - Mock `prisma` 数据库操作
   - Mock 认证插件 (`fastify.authenticate`)
   - Mock 外部服务 (如 `videoQueue`, `storage`, `ffmpeg`, `fetch`)
   - 测试正常流程 + 错误边界 (404, 403, 400)

2. **Service 测试**:
   - Mock 外部依赖
   - 测试核心逻辑和边界条件

3. **自动执行**:
   - Git Hook (`.husky/pre-commit`) 会在提交前自动运行 lint-staged 相关的测试
   - lint-staged 命令: `pnpm exec lint-staged`
   - **后端**（`packages/backend/**/*.{ts,js}`）: `vitest related`（与暂存改动相关）
   - **前端**（`packages/frontend/**/*.{ts,vue}`）: `pnpm --filter @dreamer/frontend test`（当前前端测试量少，全量 `vitest run`）

- 注意：勿随意删除或弱化上述规则；若调整 lint-staged，须保持前后端测试仍会在提交前执行。

### 测试命令

```bash
# 运行所有测试（全量，根目录：后端 + 前端）
pnpm test

# 仅后端（全量）
cd packages/backend && pnpm test --run

# 仅前端（全量）
cd packages/frontend && pnpm test

# 运行带覆盖率（后端）
cd packages/backend && pnpm test --run --coverage
```

### 提交规范

### 禁止使用 --no-verify

**重要**: 提交时**禁止使用** `git commit --no-verify` 或 `git push --no-verify` 跳过 hooks。所有提交必须通过 pre-commit hooks 的测试检查。

### 禁止自动提交

**重要**: Agent **绝对不能**自动执行 `git commit`。所有提交必须由用户明确确认后才能执行。

- ❌ 禁止：自动运行 `git add .` 和 `git commit`
- ❌ 禁止：在完成修改后自动提交
- ✅ 必须：先向用户展示修改内容，等待用户确认后再提交
- ✅ 必须：使用 `git status` 和 `git diff` 向用户展示变更

### 提交流程

```bash
# 1. 先运行测试确保通过
cd packages/backend && pnpm test --run

# 2. 展示变更给用户确认
git status
git diff

# 3. 用户确认后，再执行提交（用户明确说"提交"时才执行）
git add .
git commit -m "feat: 添加新功能"
```

## 任务中心规则

### 必须显示所有任务类型

任务中心（`/jobs`）**必须**显示所有类型的任务，包括：

| 类型       | 说明                                  | API 来源                     |
| ---------- | ------------------------------------- | ---------------------------- |
| `video`    | 视频生成任务                          | `/api/tasks`                 |
| `import`   | 剧本导入任务                          | `/api/import/tasks`          |
| `pipeline` | Pipeline 执行任务                     | `/api/pipeline/jobs`         |
| `image`    | 图片生成任务（定妆 / 定场图，BullMQ） | `/api/image-generation/jobs` |

`pipeline` 在任务中心仅在 **「类型」列** 用中文展示 **`jobType`**（`/api/pipeline/jobs` 须返回 `jobType`，`Jobs.vue` 的 `pipelineSubtypeLabel`）。新增大纲相关 `jobType` 时须同步后端列表字段与该映射。分集「AI 生成分镜脚本」使用 `jobType`=`episode-storyboard-script`（`PipelineJob`，由 `POST /api/episodes/:id/generate-storyboard-script` 创建，与完整流水线共用 `/api/pipeline/jobs` 列表）。

新增任务类型时，**必须**同步更新：

1. 后端 API（获取任务列表）
2. 前端 `Jobs.vue`（添加类型支持）
3. AGENTS.md（本规则）

## 模块开发规范

### 模块目录结构

每个功能模块应放在 `packages/backend/src/services/` 下的独立目录：

```
services/
├── tts/                    # 语音合成模块
│   ├── index.ts           # 统一导出
│   ├── base.ts            # 平台抽象接口
│   ├── mapper.ts          # 音色映射表
│   ├── aliyun.ts         # 阿里云实现
│   └── volcano.ts         # 火山引擎实现
├── scene-asset.ts         # 素材匹配（单文件模块）
└── seedance-audio.ts      # Seedance 音频对接
```

### 模块设计原则

1. **单一职责**：每个模块只负责一件事
2. **接口抽象**：对外暴露统一接口，隐藏实现细节
3. **依赖倒置**：通过接口/类型解耦，不直接依赖具体实现
4. **可测试性**：核心逻辑纯函数化，易于单元测试

---

## 语音管理模块 (TTS)

### 模块职责

语音管理模块负责：

1. 从剧本对话生成结构化语音配置（VoiceSegment）
2. 将 VoiceConfig 映射为各 TTS 平台的 voice_id
3. 提供统一 TTS 合成接口
4. 与 Seedance 2.0 音频参数对接

### 核心类型

```typescript
// packages/shared/src/types/index.ts

export interface VoiceConfig {
  gender: 'male' | 'female'
  age: 'young' | 'middle_aged' | 'old' | 'teen'
  tone: 'high' | 'mid' | 'low' | 'low_mid'
  timbre: 'warm_solid' | 'warm_thick' | 'clear_bright' | 'soft_gentle'
  speed: 'slow' | 'medium' | 'fast'
  pitch?: number
  volume?: number
}

export interface VoiceSegment {
  id?: string
  characterId: string
  order: number
  startTimeMs: number
  durationMs: number
  text: string
  voiceConfig: VoiceConfig
  emotion?: string
}
```

### TTS Provider 接口

```typescript
// packages/backend/src/services/tts/base.ts

export interface TTSOptions {
  pitch?: number
  volume?: number
  speed?: number
}

export interface TTSProvider {
  /** 提供商名称 */
  name: string
  /** 合成语音，返回音频 URL */
  synthesize(text: string, voiceId: string, options?: TTSOptions): Promise<string>
  /** 从 VoiceConfig 获取平台对应的 voice_id */
  getVoiceId(config: VoiceConfig): string
}

export function getTTSProvider(platform: 'aliyun' | 'volcano'): TTSProvider
```

### 音色映射表

```typescript
// packages/backend/src/services/tts/mapper.ts

export function getVoiceIdFromConfig(config: VoiceConfig, platform: 'aliyun' | 'volcano'): string

// 映射表示例
const ALIYUN_VOICE_MAP = {
  male: {
    young: {
      warm_solid: 'zh_male_qingrun',
      clear_bright: 'zh_male_qingse',
      default: 'zh_male_shaonian'
    },
    middle_aged: {
      /* ... */
    },
    old: {
      /* ... */
    }
  },
  female: {
    /* ... */
  }
}
```

### Seedance 音频对接

```typescript
// packages/backend/src/services/seedance-audio.ts

export interface SeedanceAudioSegment {
  character_tag: string // @Character1
  text: string
  voice_config: VoiceConfig
  start_time: number // 秒
  duration: number // 秒
}

export interface SeedanceAudioPayload {
  type: 'tts'
  segments: SeedanceAudioSegment[]
}

/** 从数据库读取 VoiceSegment，组装成 Seedance 音频参数 */
export async function buildSeedanceAudio(segmentId: string): Promise<SeedanceAudioPayload>

/** 获取分镜关联的所有语音片段 */
export async function getSegmentVoiceSegments(segmentId: string): Promise<VoiceSegment[]>
```

### VoiceSegment 生成流程

```
ScriptScene.dialogues[]
        ↓
buildVoiceSegments(scene, characters)
        ↓
VoiceSegment[] (存入数据库)
        ↓
buildSeedanceAudio(segmentId) → SeedanceAudioPayload
        ↓
Seedance API (generateAudio: true)
```

### 新增模块检查清单

新增 TTS 相关模块时，必须：

1. **类型定义**：在 `packages/shared/src/types/index.ts` 添加类型
2. **Provider 实现**：实现 `TTSProvider` 接口
3. **映射表**：在 `mapper.ts` 添加平台映射
4. **统一导出**：在 `index.ts` 导出
5. **数据库模型**：如需持久化，添加到 `schema.prisma`
6. **测试用例**：编写单元测试，覆盖率 > 90%
7. **文档**：更新本节内容

---

## 计划文档管理

### 计划文档位置

所有计划文档存放在 `docs/plans/` 目录，命名格式：

```
docs/plans/<计划名称>_<YYYYMMDD>.md
```

例如：`Pipeline重构计划_20260411.md`

### 计划文档归档规则

1. **创建时**：在 `docs/plans/` 创建带日期的计划文档
2. **完成后**：将计划文档移到 `docs/plans/` 并归档
3. **实时更新**：计划中的任务状态变更时，同步更新文档中的任务状态

### 禁止以 `~/.cursor/plans/` 为事实来源

- Cursor 可能在用户目录下生成 `~/.cursor/plans/*.plan.md`，**那只是本机草稿**。
- **仓库内唯一事实来源**仍是 `docs/plans/<计划名称>_<YYYYMMDD>.md`：若在 Cursor 里先写出了计划，**必须复制或迁到 `docs/plans/` 并纳入 Git**，不要只在 `~/.cursor/plans/` 留一份。
- Agent/协作者**不得**把「计划」只写进 `~/.cursor/plans/` 而不落到 `docs/plans/`。

---

## 常见问题

### Prisma：`migrations` 与版本管理、要记几条命令？

- **`packages/backend/prisma/migrations/` 必须进 Git**，与 `schema.prisma` 一起作为「库结构变更」的唯一事实来源。仓库里曾误把该目录写进 `.gitignore`，已去掉；拉代码后同事用同一条迁移链即可对齐。
- **当前迁移链**：单条 baseline `20260416120000_baseline_schema`（空库一次 `migrate deploy` 建全表；开头 `DROP TABLE IF EXISTS "OutlineJob"`，丢弃已下线大纲任务表）。在**已有数据**且此前只用 `db push`、从未对齐过本迁移的库上，请勿对生产库直接跑 baseline（会 `CREATE TABLE` 冲突）；应备份后用 `migrate diff` 生成增量，或新库 / `migrate reset` 后再 deploy。
- **日常部署 / 本地对齐结构，只需记一条**：`pnpm --filter @dreamer/backend run db:migrate:deploy`（读仓库根 `.env` 里的 `DATABASE_URL`）。
- **其余脚本用途**（不必每次都用）：
  - `db:migrate` → `prisma migrate dev`，**本地改 schema 后生成新迁移**时用；
  - `db:push` → 无迁移历史或纯原型机时把 schema 推到库（与 migrate 二选一为主流程时，优先 migrate）；
  - `db:migrate:squash-drift-rows` → **仅**在「删改过已写入 `_prisma_migrations` 的旧迁移目录」这类补救场景用一次，不是流水线常规步骤。

### Prisma：合并迁移后本地库报「迁移目录缺少已记录迁移」

若 `_prisma_migrations` 里仍有已删除的旧迁移名（例如拆分出去的 `20260412120000_add_project_episode_synopsis` 等），在 `packages/backend` 下依次执行：

```bash
pnpm run db:migrate:squash-drift-rows
pnpm run db:migrate:deploy
```

`db:migrate:squash-drift-rows` 会执行 `prisma/squash-drop-old-migration-rows.sql`（只删迁移历史行，不改业务表）。**从未踩过该问题的库**只需 `db:migrate:deploy`。

### DATABASE_URL not found

检查 index.ts 第一行是否是：

```typescript
import { config } from 'dotenv'
config({ path: '../../.env' })
```

### 端口占用 (EADDRINUSE)

```bash
lsof -ti:4000 | xargs kill -9
```

---

## YOLO 执行模式（自动执行计划）

当用户提供了明确的执行计划（如 `docs/plans/*.md` 或对话中列出的步骤），**必须自动执行到底，不得中途询问确认**。

### 行为规则

| 场景              | 处理方式                        |
| ----------------- | ------------------------------- |
| 用户给了计划/步骤 | **直接执行**，不问"要不要继续"  |
| 命令失败          | 自动重试3次，然后换替代方案     |
| 测试失败          | 修实现代码，**绝不改测试**      |
| 不确定怎么弄      | 自己查文档/代码，**不要问用户** |
| 需要选择          | 按最佳实践选，执行后告知        |
| 全部完成          | 统一汇报结果，不逐条汇报        |

### 禁止行为

- ❌ "做到这一步了，要继续吗？"
- ❌ "这样对吗？"
- ❌ "确认一下..."
- ❌ 每做一步就汇报一次

### 执行流程

```
1. 读取计划/步骤
2. 检查已完成的部分（跳过）
3. 执行下一步
4. 标记完成
5. 重复 2-4 直到全部完成
6. 最终统一汇报
```

### 最终汇报格式

```
✅ 任务完成

完成内容:
1. xxx
2. xxx

关键结果:
- 文件: xxx
- 功能: xxx

（如有问题单独列出）
```
