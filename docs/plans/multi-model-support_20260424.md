# 多模型支持计划 — 统一 Provider 架构

**日期**: 2026-04-24  
**范围**: 后端 `packages/backend/src/services/ai/` 及关联调用方  
**目标**: 文本模型、图片模型、视频模型、联网搜索全部统一为 Provider + Registry 架构，支持多 Provider / 多模型切换。

> **核心设计原则**: 所有外部 AI 服务（LLM / 图片 / 视频 / 搜索）统一使用 **Provider 接口 + Registry 注册表 + Factory 工厂** 三层架构，新服务接入仅需实现接口 + 注册即可。

---

## 1. 现状分析

### 1.1 文本模型（LLM）

| 维度     | 现状                                                                    | 问题                        |
| -------- | ----------------------------------------------------------------------- | --------------------------- |
| 架构     | 已有 `LLMProvider` 接口 + `llm-registry.ts` Registry 模式               | 良好，但仅注册了 `deepseek` |
| 调用入口 | `getDefaultProvider()` → 固定读 `DEEPSEEK_API_KEY`                      | 无法切换 Provider/模型      |
| 调用方   | ~20 处通过 `getDefaultProvider()` 获取 Provider                         | 全部硬编码                  |
| 成本计算 | `deepseek-client.ts` 仅支持 DeepSeek 定价                               | 新增 Provider 需独立计价    |
| 日志     | `logDeepSeekChat` 硬写 `model: 'deepseek-chat'`, `provider: 'deepseek'` | 日志失真                    |
| 流式聊天 | `chat-stream-service.ts` 直接 `new OpenAI()` 绕过 Provider 抽象         | 无法切换                    |

### 1.2 图片模型

| 维度     | 现状                                                                 | 问题             |
| -------- | -------------------------------------------------------------------- | ---------------- |
| 架构     | `image-generation.ts` 直接 `fetch()` 调用方舟 `images/generations`   | 无 Provider 抽象 |
| 模型配置 | 环境变量 `ARK_IMAGE_T2I_MODEL` / `ARK_IMAGE_EDIT_MODEL`              | 仅支持方舟单平台 |
| 调用方   | `queues/image.ts` Worker 直接调用 `generateTextToImageAndPersist` 等 | 硬编码           |
| 成本     | `extractImageCostFromArkResponse` 仅解析方舟响应                     | 无法扩展         |
| 日志     | `recordModelApiCall` 硬写 `provider: 'volcengine-ark'`               | 日志失真         |

### 1.3 视频模型

| 维度     | 现状                                                                   | 问题             |
| -------- | ---------------------------------------------------------------------- | ---------------- |
| 架构     | `seedance.ts` 直接 `fetch()` 调用方舟 Seedance 2.0                     | 无 Provider 抽象 |
| 模型配置 | 硬编码 `SEEDANCE_MODEL = 'doubao-seedance-2-0-fast-260128'`            | 仅支持方舟单平台 |
| 调用方   | `routes/video.ts` 直接调用 `submitSeedanceTask` / `pollSeedanceStatus` | 硬编码           |
| 成本     | `calculateSeedanceCost` 固定 ¥1/秒                                     | 无法扩展         |
| 日志     | 未统一落库 `ModelApiCall`                                              | 缺失审计         |

### 1.4 联网搜索

| 维度   | 现状       | 问题       |
| ------ | ---------- | ---------- |
| 架构   | 无搜索服务 | 需新建     |
| 调用方 | 无         | 需新建     |
| 日志   | 无         | 需统一落库 |

---

## 2. 统一 Provider 架构设计

### 2.1 核心抽象层

所有 AI 服务共享同一套 **Provider 接口 + Registry + Factory** 模式：

```
services/ai/
├── core/                           # 核心抽象层（所有 Provider 共享）
│   ├── provider-interface.ts       # 统一 Provider 基础接口
│   ├── provider-registry.ts        # 统一 Registry（泛型）
│   ├── provider-factory.ts         # 统一 Factory（泛型）
│   └── cost-calculator.ts          # 统一成本计算接口
│
├── llm/                            # 文本模型 Provider 目录
│   ├── llm-provider.ts             # LLMProvider 接口（继承 core）
│   ├── llm-registry.ts             # LLM 专用 Registry
│   ├── llm-factory.ts              # LLM 专用 Factory
│   ├── llm-model-catalog.ts        # 声明式模型配置
│   ├── providers/
│   │   ├── deepseek-provider.ts    # DeepSeek（V4 Flash / V4 Pro）
│   │   ├── openai-provider.ts      # OpenAI / Azure
│   │   ├── claude-provider.ts      # Anthropic Claude
│   │   ├── qwen-provider.ts        # 通义千问
│   │   └── ark-llm-provider.ts     # 火山方舟 LLM
│   └── index.ts                    # 统一导出
│
├── image/                          # 图片模型 Provider 目录
│   ├── image-provider.ts           # ImageProvider 接口
│   ├── image-registry.ts           # Image 专用 Registry
│   ├── image-factory.ts            # Image 专用 Factory
│   ├── providers/
│   │   ├── ark-image-provider.ts   # 火山方舟 Seedream
│   │   ├── kling-image-provider.ts # 可灵 Kling Omni-Image
│   │   └── openai-image-provider.ts # OpenAI DALL-E 3
│   └── index.ts
│
├── video/                          # 视频模型 Provider 目录
│   ├── video-provider.ts           # VideoProvider 接口
│   ├── video-registry.ts           # Video 专用 Registry
│   ├── video-factory.ts            # Video 专用 Factory
│   ├── providers/
│   │   ├── ark-video-provider.ts   # 火山方舟 Seedance 2.0
│   │   └── kling-video-provider.ts # 可灵 Kling Omni-Video
│   └── index.ts
│
└── search/                         # 联网搜索 Provider 目录
    ├── search-provider.ts          # SearchProvider 接口
    ├── search-registry.ts          # Search 专用 Registry
    ├── search-factory.ts           # Search 专用 Factory
    ├── providers/
    │   └── volc-search-provider.ts # 火山方舟 WebSearch
    └── index.ts
```

### 2.2 统一 Provider 基础接口

```typescript
// core/provider-interface.ts

/** 所有 AI Provider 的基础接口 */
export interface BaseProvider {
  readonly name: string
  readonly type: 'llm' | 'image' | 'video' | 'search'
  getConfig(): ProviderConfig
}

export interface ProviderConfig {
  provider: string
  apiKey: string
  baseURL?: string
  defaultModel?: string
}

/** 统一成本结果 */
export interface CostResult {
  costCNY: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  /** 其他 Provider 特定指标 */
  metadata?: Record<string, unknown>
}

/** 统一 API 调用结果 */
export interface ApiCallResult {
  provider: string
  model: string
  cost: CostResult | null
  rawResponse: unknown
}
```

### 2.3 各服务专用 Provider 接口

```typescript
// llm/llm-provider.ts
export interface LLMProvider extends BaseProvider {
  readonly type: 'llm'
  complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletion>
  stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncIterable<LLMStreamChunk>
}

// image/image-provider.ts
export interface ImageProvider extends BaseProvider {
  readonly type: 'image'
  generateTextToImage(prompt: string, options?: TextToImageOptions): Promise<ImageGenerationResult>
  generateImageEdit(
    referenceImageUrl: string,
    prompt: string,
    options?: ImageEditOptions
  ): Promise<ImageGenerationResult>
}

// video/video-provider.ts
export interface VideoProvider extends BaseProvider {
  readonly type: 'video'
  submitGeneration(request: VideoGenerationRequest): Promise<VideoTaskResponse>
  queryStatus(taskId: string): Promise<VideoStatusResponse>
}

// search/search-provider.ts
export interface SearchProvider extends BaseProvider {
  readonly type: 'search'
  searchWeb(query: string, options?: WebSearchOptions): Promise<WebSearchResult>
  searchWebSummary(query: string, options?: WebSearchOptions): Promise<WebSearchSummaryResult>
  searchImages(query: string, options?: ImageSearchOptions): Promise<ImageSearchResult>
}
```

### 2.4 统一 Registry（泛型实现）

```typescript
// core/provider-registry.ts

export class ProviderRegistry<T extends BaseProvider> {
  private providers = new Map<string, ProviderFactory<T>>()

  register(name: string, factory: ProviderFactory<T>): void {
    this.providers.set(name.toLowerCase(), factory)
  }

  create(config: ProviderConfig): T {
    const factory = this.providers.get(config.provider.toLowerCase())
    if (!factory) {
      throw new Error(`Unknown provider: ${config.provider}`)
    }
    return factory(config)
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }
}

export type ProviderFactory<T> = (config: ProviderConfig) => T
```

### 2.5 统一 Factory 与默认 Provider 获取

```typescript
// core/provider-factory.ts

export function createProvider<T extends BaseProvider>(
  registry: ProviderRegistry<T>,
  config: ProviderConfig
): T {
  return registry.create(config)
}

/** 根据环境变量获取默认 Provider（通用逻辑） */
export function getDefaultProviderFromEnv<T extends BaseProvider>(
  registry: ProviderRegistry<T>,
  envPrefix: string, // 如 'LLM', 'IMAGE', 'VIDEO', 'SEARCH'
  defaultProvider: string
): T {
  const providerName = process.env[`${envPrefix}_DEFAULT_PROVIDER`] || defaultProvider
  // 根据 providerName 读取对应 API Key 和配置
  // ...
}
```

---

## 3. 各服务详细设计

### 3.1 文本模型（LLM）

**声明式模型配置**（`llm/llm-model-catalog.ts`）：

```typescript
export const DEEPSEEK_V4_PRICING = {
  'deepseek-v4-flash': { inputCacheHit: 0.2, inputCacheMiss: 1.0, output: 2.0 },
  'deepseek-v4-pro': { inputCacheHit: 1.0, inputCacheMiss: 12.0, output: 24.0 }
} as const

export const DEEPSEEK_MODEL_ALIASES = {
  'deepseek-chat': 'deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek-v4-flash',
  'deepseek-coder': 'deepseek-v4-flash',
  'deepseek-v3': 'deepseek-v4-flash'
} as const
```

**关键改造**：

- `llm-call-wrapper.ts` 的 `LLMCallResult.cost` 改为通用 `CostResult`
- `logDeepSeekChat` → `logLLMCall`，接收真实 `model` / `provider`
- `chat-stream-service.ts` 使用 `LLMProvider.stream()`

### 3.2 图片模型（Image）

**Provider 列表**：
| Provider | 文件 | 接口类型 | 特点 |
|----------|------|----------|------|
| 火山方舟 | `ark-image-provider.ts` | 同步 | OpenAI 兼容 |
| 可灵 | `kling-image-provider.ts` | **异步任务** | 创建→轮询 |
| OpenAI | `openai-image-provider.ts` | 同步 | OpenAI 兼容 |

**ImageProvider 接口**：

```typescript
export interface ImageProvider extends BaseProvider {
  readonly type: 'image'
  generateTextToImage(prompt: string, options?: TextToImageOptions): Promise<ImageGenerationResult>
  generateImageEdit(
    referenceImageUrl: string,
    prompt: string,
    options?: ImageEditOptions
  ): Promise<ImageGenerationResult>
}

export interface ImageGenerationResult extends ApiCallResult {
  url: string
  imageCost: number | null
}
```

### 3.3 视频模型（Video）

**Provider 列表**：
| Provider | 文件 | 接口类型 | 特点 |
|----------|------|----------|------|
| 火山方舟 | `ark-video-provider.ts` | 异步任务 | Seedance 2.0 |
| 可灵 | `kling-video-provider.ts` | **异步任务** | Omni-Video，支持多镜头 |

**VideoProvider 接口**：

```typescript
export interface VideoProvider extends BaseProvider {
  readonly type: 'video'
  submitGeneration(request: VideoGenerationRequest): Promise<VideoTaskResponse>
  queryStatus(taskId: string): Promise<VideoStatusResponse>
  cancelTask?(taskId: string): Promise<void>
}

export interface VideoGenerationRequest {
  prompt: string
  model?: string
  imageUrls?: string[]
  videoUrl?: string
  duration?: number
  aspectRatio?: string
  mode?: 'std' | 'pro' | '4k'
  sound?: 'on' | 'off'
  // Kling 特有
  multiShot?: boolean
  shotType?: 'customize' | 'intelligence'
  multiPrompt?: Array<{ index: number; prompt: string; duration: string }>
}
```

**Kling Omni-Video 关键参数**：

- `model_name`: `kling-video-o1` / `kling-v3-omni`
- `multi_shot`: 多镜头模式（最多 6 个分镜）
- `shot_type`: `customize`（自定义分镜）/ `intelligence`（智能分镜）
- `image_list`: 参考图（支持首尾帧 `first_frame` / `end_frame`）
- `video_list`: 参考视频（`refer_type`: `feature` 特征参考 / `base` 待编辑）
- `mode`: `std`(720P) / `pro`(1080P) / `4k`
- `sound`: `on` / `off`

### 3.4 联网搜索（Search）

**SearchProvider 接口**：

```typescript
export interface SearchProvider extends BaseProvider {
  readonly type: 'search'
  searchWeb(query: string, options?: WebSearchOptions): Promise<WebSearchResult>
  searchWebSummary(query: string, options?: WebSearchOptions): Promise<WebSearchSummaryResult>
  searchImages(query: string, options?: ImageSearchOptions): Promise<ImageSearchResult>
}

export interface WebSearchOptions {
  count?: number
  needContent?: boolean
  needUrl?: boolean
  needSummary?: boolean
  timeRange?: 'OneDay' | 'OneWeek' | 'OneMonth' | 'OneYear' | string
  sites?: string[]
  blockHosts?: string[]
  authInfoLevel?: 0 | 1
}
```

**火山方舟 WebSearch 特点**：

- `web`: 返回 `WebItem[]`（标题、摘要、正文、权威度）
- `web_summary`: 返回 `WebItem[]` + `Choices[]`（LLM 总结，支持流式 SSE）
- `image`: 返回 `ImageItem[]`（图片 URL、尺寸、水印状态）
- 计费：个人 500次/月免费，企业 5000次/月免费

---

## 4. 统一配置规范（环境变量）

```bash
# ========== 文本模型 ==========
LLM_DEFAULT_PROVIDER=deepseek

DEEPSEEK_API_KEY=xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_DEFAULT_MODEL=deepseek-v4-flash

OPENAI_API_KEY=xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_DEFAULT_MODEL=gpt-4o

CLAUDE_API_KEY=xxx
CLAUDE_BASE_URL=https://api.anthropic.com
CLAUDE_DEFAULT_MODEL=claude-3-sonnet-20240229

QWEN_API_KEY=xxx
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_DEFAULT_MODEL=qwen-max

ARK_LLM_API_KEY=xxx
ARK_LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_LLM_DEFAULT_MODEL=doubao-pro-32k-241215

# ========== 图片模型 ==========
IMAGE_DEFAULT_PROVIDER=ark

ARK_IMAGE_API_KEY=xxx
ARK_IMAGE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_IMAGE_T2I_MODEL=doubao-seedream-5-0-lite-260128
ARK_IMAGE_EDIT_MODEL=doubao-seedream-5-0-lite-260128

KLING_IMAGE_API_KEY=xxx
KLING_IMAGE_BASE_URL=https://api-beijing.klingai.com
KLING_IMAGE_T2I_MODEL=kling-image-o1

OPENAI_IMAGE_API_KEY=xxx
OPENAI_IMAGE_BASE_URL=https://api.openai.com/v1
OPENAI_IMAGE_T2I_MODEL=dall-e-3

# ========== 视频模型 ==========
VIDEO_DEFAULT_PROVIDER=ark

ARK_VIDEO_API_KEY=xxx
ARK_VIDEO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_VIDEO_MODEL=doubao-seedance-2-0-fast-260128

KLING_VIDEO_API_KEY=xxx
KLING_VIDEO_BASE_URL=https://api-beijing.klingai.com
KLING_VIDEO_MODEL=kling-video-o1

# ========== 联网搜索 ==========
SEARCH_DEFAULT_PROVIDER=volc

VOLC_SEARCH_API_KEY=xxx
VOLC_SEARCH_BASE_URL=https://open.feedcoopapi.com
```

---

## 5. 统一可观测性

所有 Provider 调用统一落库 `ModelApiCall`：

| 字段       | LLM                   | Image                      | Video            | Search                |
| ---------- | --------------------- | -------------------------- | ---------------- | --------------------- |
| `provider` | `deepseek` / `openai` | `ark` / `kling` / `openai` | `ark` / `kling`  | `volc`                |
| `model`    | `deepseek-v4-flash`   | `doubao-seedream-5-0`      | `kling-video-o1` | `web` / `web_summary` |
| `cost`     | token 计价            | 按次/按量                  | 按时长           | 按次                  |
| `prompt`   | user message          | image prompt               | video prompt     | search query          |

---

## 6. 实施步骤

### Phase 1: 核心抽象层

1. **新建 `ai/core/` 目录**：
   - `provider-interface.ts` — 统一基础接口
   - `provider-registry.ts` — 泛型 Registry
   - `provider-factory.ts` — 泛型 Factory
   - `cost-calculator.ts` — 统一成本接口

2. **迁移现有 LLM 代码到 `ai/llm/`**：
   - 将 `llm-provider.ts` / `llm-registry.ts` / `llm-factory.ts` 移入
   - 适配新的 `core` 接口

### Phase 2: 文本模型

1. 新建 `llm/llm-model-catalog.ts`（声明式配置）
2. 改造 `deepseek-provider.ts` 支持 V4 定价 + 缓存状态
3. 改造 `llm-call-wrapper.ts` 使用 `CostResult`
4. 改造 `model-call-log.ts` → `logLLMCall`
5. 新增 `openai-provider.ts` / `ark-llm-provider.ts`
6. 改造 `chat-stream-service.ts` 使用 `LLMProvider.stream()`

### Phase 3: 图片模型

1. 新建 `image/image-provider.ts` / `image-registry.ts` / `image-factory.ts`
2. 迁移 `image-generation.ts` → `image/providers/ark-image-provider.ts`
3. 新增 `kling-image-provider.ts`（异步任务模式）
4. 新增 `openai-image-provider.ts`
5. 改造 `queues/image.ts` 使用 `ImageProvider`

### Phase 4: 视频模型

1. 新建 `video/video-provider.ts` / `video-registry.ts` / `video-factory.ts`
2. 迁移 `seedance.ts` → `video/providers/ark-video-provider.ts`
3. 新增 `kling-video-provider.ts`（Omni-Video，异步任务）
4. 改造视频相关路由使用 `VideoProvider`

### Phase 5: 联网搜索

1. 新建 `search/search-provider.ts` / `search-registry.ts` / `search-factory.ts`
2. 新增 `search/providers/volc-search-provider.ts`
3. 封装 `web` / `web_summary` / `image` 三种搜索
4. `web_summary` 支持 SSE 流式

### Phase 6: 前端模型切换

1. Prisma：`User` 表新增 `modelPreferences Json?`
2. 后端：`GET /api/models` 返回所有可用模型（LLM + Image + Video + Search）
3. 后端：`GET/PUT /api/settings/model-preferences`
4. 前端：`stores/model.ts` + `components/ModelSelector.vue`
5. 前端：各 AI 生成入口集成模型切换

### Phase 7: 收尾

1. 更新 `.env.example`
2. 更新 `AGENTS.md` / `CODING_STANDARDS.md`
3. 全量测试 `pnpm test`

---

## 7. 验收标准

- [ ] 所有 AI 服务（LLM / Image / Video / Search）统一使用 Provider 架构
- [ ] 新增 Provider 仅需：实现接口 + 注册到 Registry + 配置环境变量
- [ ] `ModelApiCall` 统一记录所有 AI 调用（provider / model / cost）
- [ ] DeepSeek V4 定价（缓存命中/未命中）计算准确
- [ ] Kling 图片/视频异步任务模式正常工作
- [ ] 火山方舟联网搜索 `web` / `web_summary` / `image` 正常工作
- [ ] 前端可切换所有类型模型
- [ ] 测试覆盖率 > 90%

---

## 8. 任务拆分

```
Phase 1: 核心抽象层
  1.1 新建 ai/core/provider-interface.ts
  1.2 新建 ai/core/provider-registry.ts（泛型）
  1.3 新建 ai/core/provider-factory.ts
  1.4 新建 ai/core/cost-calculator.ts
  1.5 迁移现有 LLM 代码到 ai/llm/ 目录

Phase 2: 文本模型
  2.1 新建 llm/llm-model-catalog.ts
  2.2 改造 deepseek-provider.ts（V4 定价 + 缓存）
  2.3 改造 llm-call-wrapper.ts（CostResult）
  2.4 改造 model-call-log.ts → logLLMCall
  2.5 新增 openai-provider.ts / ark-llm-provider.ts
  2.6 改造 chat-stream-service.ts
  2.7 编写测试

Phase 3: 图片模型
  3.1 新建 image/image-provider.ts / registry / factory
  3.2 迁移 ark-image-provider.ts
  3.3 新增 kling-image-provider.ts（异步任务）
  3.4 新增 openai-image-provider.ts
  3.5 改造 queues/image.ts
  3.6 编写测试

Phase 4: 视频模型
  4.1 新建 video/video-provider.ts / registry / factory
  4.2 迁移 seedance.ts → ark-video-provider.ts
  4.3 新增 kling-video-provider.ts（Omni-Video）
  4.4 改造视频路由
  4.5 编写测试

Phase 5: 联网搜索
  5.1 新建 search/search-provider.ts / registry / factory
  5.2 新增 volc-search-provider.ts
  5.3 封装 web / web_summary / image
  5.4 编写测试

Phase 6: 前端模型切换
  6.1 Prisma：User.modelPreferences
  6.2 后端：GET /api/models
  6.3 后端：GET/PUT /api/settings/model-preferences
  6.4 前端：stores/model.ts + components/ModelSelector.vue
  6.5 前端：集成到各 AI 入口

Phase 7: 收尾
  7.1 更新 .env.example
  7.2 更新 AGENTS.md / CODING_STANDARDS.md
  7.3 全量测试 pnpm test
```
