# 代码质量重构计划 - 基于 SOLID 原则与设计模式

**创建日期**: 2026-04-22  
**优先级**: High  
**预计工时**: 9.5 小时  
**风险等级**: 低-中（渐进式重构，保持向后兼容）

---

## 📋 概述

基于 [CodeReview_CleanCode_Audit_20260422.md](./CodeReview_CleanCode_Audit_20260422.md) 的审查结果，系统性解决以下问题：

1. **SRP 违反** - 拆分 God Object（586行、541行文件）
2. **OCP 违反** - 替换 switch 语句为 Strategy/Registry 模式
3. **缺少 Facade** - 为复杂工作流提供简化接口

**目标**：

- ✅ 提高代码可测试性（更小的单元）
- ✅ 提高可扩展性（OCP 支持插件化）
- ✅ 降低维护成本（清晰的职责边界）

---

## 🎯 重构任务清单

### Phase 1: Critical - LLM Factory Registry 模式

**优先级**: 🔴 Critical  
**预计工时**: 1 小时  
**风险**: 低（纯重构，不改变功能）  
**文件**: `packages/backend/src/services/ai/llm-factory.ts`

#### 当前问题

```typescript
// ❌ 违反 OCP - 添加新 provider 需要修改此文件
export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider.toLowerCase()) {
    case 'deepseek':
      return new DeepSeekProvider(config)
    case 'openai':
      throw new Error('OpenAI provider not yet implemented')
    case 'claude':
      throw new Error('Claude provider not yet implemented')
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}
```

#### 重构方案

**步骤 1**: 创建 Provider Registry

```typescript
// packages/backend/src/services/ai/llm-registry.ts
import type { LLMConfig, LLMProvider } from './types.js'

export type LLMProviderFactory = (config: LLMConfig) => LLMProvider

class LLMProviderRegistry {
  private providers = new Map<string, LLMProviderFactory>()

  register(name: string, factory: LLMProviderFactory): void {
    this.providers.set(name.toLowerCase(), factory)
  }

  create(config: LLMConfig): LLMProvider {
    const factory = this.providers.get(config.provider.toLowerCase())
    if (!factory) {
      const available = Array.from(this.providers.keys()).join(', ')
      throw new Error(`Unknown LLM provider: ${config.provider}. Available: ${available}`)
    }
    return factory(config)
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name.toLowerCase())
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }
}

export const llmRegistry = new LLMProviderRegistry()

// 便捷函数
export function registerLLMProvider(name: string, factory: LLMProviderFactory) {
  llmRegistry.register(name, factory)
}

export function createLLMProvider(config: LLMConfig): LLMProvider {
  return llmRegistry.create(config)
}
```

**步骤 2**: 注册现有 Provider

```typescript
// packages/backend/src/services/ai/llm-factory.ts
import { registerLLMProvider } from './llm-registry.js'
import { DeepSeekProvider } from './deepseek-provider.js'

// 注册 DeepSeek provider
registerLLMProvider('deepseek', (config) => new DeepSeekProvider(config))

// 未来添加新 provider 只需在这里注册：
// registerLLMProvider('openai', (config) => new OpenAIProvider(config))
// registerLLMProvider('claude', (config) => new ClaudeProvider(config))
```

**步骤 3**: 更新导出

```typescript
// packages/backend/src/services/ai/index.ts
export { llmRegistry, registerLLMProvider, createLLMProvider } from './llm-registry.js'
```

#### 测试策略

```typescript
// packages/backend/tests/ai/llm-registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { llmRegistry, registerLLMProvider } from '../../src/services/ai/llm-registry.js'

describe('LLMProviderRegistry', () => {
  beforeEach(() => {
    // 清理 registry（如果需要）
  })

  it('should register and create provider', () => {
    const mockFactory = vi.fn().mockReturnValue({ name: 'mock' })
    registerLLMProvider('mock', mockFactory)

    const provider = llmRegistry.create({ provider: 'mock', apiKey: 'test' })
    expect(provider.name).toBe('mock')
    expect(mockFactory).toHaveBeenCalled()
  })

  it('should throw for unknown provider', () => {
    expect(() => llmRegistry.create({ provider: 'unknown', apiKey: 'test' })).toThrow(
      /Unknown LLM provider/
    )
  })

  it('should list registered providers', () => {
    const providers = llmRegistry.listProviders()
    expect(providers).toContain('deepseek')
  })
})
```

#### 验收标准

- [ ] 现有功能不受影响（所有测试通过）
- [ ] 可以通过 `registerLLMProvider()` 添加新 provider
- [ ] 错误消息包含可用的 provider 列表
- [ ] 单元测试覆盖率 > 90%

---

### Phase 2: Critical - 拆分 project-script-jobs.ts

**优先级**: 🔴 Critical  
**预计工时**: 3 小时  
**风险**: 中（需要确保导出兼容性）  
**文件**: `packages/backend/src/services/project-script-jobs.ts` (586行)

#### 当前问题

该文件承担了过多职责：

1. 剧本模式检测
2. 首集生成编排
3. 批量剧集生成
4. 完整剧本解析
5. AI 创作流程
6. 记忆提取
7. Job 状态更新

#### 重构方案

**新文件结构**:

```
services/
├── script-processing/
│   ├── index.ts                    # 统一导出
│   ├── script-mode-router.ts       # 模式检测和路由 (从 script-mode-detector 整合)
│   ├── first-episode-generator.ts  # 首集生成编排
│   ├── batch-episode-generator.ts  # 批量生成
│   ├── script-parser.ts            # 完整剧本解析
│   └── script-job.types.ts         # 共享类型定义
└── project-script-jobs.ts          # 保留向后兼容的 re-export
```

**步骤 1**: 创建 ScriptModeRouter

```typescript
// packages/backend/src/services/script-processing/script-mode-router.ts
import type { Project } from '@prisma/client'
import { detectScriptMode, type ScriptModeDetectionResult } from '../script-mode-detector.js'
import type { ScriptProcessor } from './types.js'
import { FaithfulParseProcessor } from './faithful-parse-processor.js'
import { MixedModeProcessor } from './mixed-mode-processor.js'

export class ScriptModeRouter {
  route(project: Project): ScriptProcessor {
    const detection = detectScriptMode(project.description || '')

    if (detection.mode === 'faithful-parse') {
      return new FaithfulParseProcessor()
    }

    return new MixedModeProcessor()
  }

  detectMode(description: string): ScriptModeDetectionResult {
    return detectScriptMode(description)
  }
}

export const scriptModeRouter = new ScriptModeRouter()
```

**步骤 2**: 提取 FirstEpisodeGenerator

```typescript
// packages/backend/src/services/script-processing/first-episode-generator.ts
import type { Project } from '@prisma/client'
import { scriptModeRouter } from './script-mode-router.js'
import { projectRepository } from '../../repositories/project-repository.js'
import { safeExtractAndSaveMemories } from '../memory/index.js'
import { STORY_CONTEXT_MAX_LENGTH } from '../project-script-jobs.constants.js'

export interface FirstEpisodeOptions {
  projectId: string
  targetEpisodes?: number
}

export interface FirstEpisodeResult {
  episodeCount: number
  parsedCount: number
  failedCount: number
}

export class FirstEpisodeGenerator {
  async generate(options: FirstEpisodeOptions): Promise<FirstEpisodeResult> {
    const project = await projectRepository.findUniqueById(options.projectId)
    if (!project) {
      throw new Error('PROJECT_NOT_FOUND')
    }

    const processor = scriptModeRouter.route(project)

    // 更新项目上下文
    await this.updateProjectContext(project)

    // 处理剧集
    return await processor.process(project, options)
  }

  private async updateProjectContext(project: Project): Promise<void> {
    await projectRepository.update(project.id, {
      synopsis: project.description,
      storyContext: (project.description || '').slice(0, STORY_CONTEXT_MAX_LENGTH)
    })
  }
}

export const firstEpisodeGenerator = new FirstEpisodeGenerator()
```

**步骤 3**: 创建向后兼容的 re-export

```typescript
// packages/backend/src/services/project-script-jobs.ts (重构后)
/**
 * @deprecated 使用 script-processing/ 下的新模块
 * 保留此文件以维持向后兼容
 */

// Re-export 所有新功能
export {
  firstEpisodeGenerator,
  batchEpisodeGenerator,
  scriptParser,
  scriptModeRouter
} from './script-processing/index.js'

// Re-export 原有的公共 API
export {
  scriptFromJson,
  areEpisodeScriptsComplete,
  buildEpisodePlansFromDbEpisodes,
  mergeEpisodesToScriptContent
} from './script-job-helpers.js'

export {
  detectScriptMode,
  calculateOverallScore,
  detectEpisodesMode
} from './script-mode-detector.js'

export type { EpisodeProcessingMode, EpisodeCompleteness } from './script-mode-detector.js'
export { DEFAULT_TARGET_EPISODES } from './project-script-jobs.constants.js'

// 包装旧函数以调用新实现
export async function runGenerateFirstEpisode(projectId: string, targetEpisodes?: number) {
  console.warn('[DEPRECATED] Use firstEpisodeGenerator.generate() instead')
  return firstEpisodeGenerator.generate({ projectId, targetEpisodes })
}
```

#### 测试策略

```typescript
// packages/backend/tests/script-processing/first-episode-generator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { firstEpisodeGenerator } from '../../src/services/script-processing/first-episode-generator.js'

vi.mock('../../src/repositories/project-repository.js')
vi.mock('../../src/services/script-processing/script-mode-router.js')

describe('FirstEpisodeGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw for non-existent project', async () => {
    await expect(firstEpisodeGenerator.generate({ projectId: 'invalid' })).rejects.toThrow(
      'PROJECT_NOT_FOUND'
    )
  })

  it('should process faithful-parse mode', async () => {
    // Mock project with complete script
    // Verify processor.route() returns FaithfulParseProcessor
    // Verify process() is called
  })

  it('should process mixed mode', async () => {
    // Mock project with idea
    // Verify processor.route() returns MixedModeProcessor
  })
})
```

#### 验收标准

- [ ] 新模块可以独立使用
- [ ] 旧的 `runGenerateFirstEpisode()` 仍可用（向后兼容）
- [ ] 所有现有测试通过
- [ ] 新模块有完整的单元测试
- [ ] 添加 deprecation warning

---

### Phase 3: High - Pipeline Step Strategy 模式

**优先级**: 🟠 High  
**预计工时**: 2 小时  
**风险**: 中  
**文件**: `packages/backend/src/services/pipeline-orchestrator.ts`

#### 当前问题

```typescript
// ❌ 违反 OCP - 添加新步骤需要修改 switch
switch (step) {
  case 'script-writing':
    return { step, status: 'failed', error: '...' }
  case 'episode-splitting':
  // 100+ lines of logic
  case 'scene-generation':
  // 100+ lines of logic
  // 每添加新步骤都需要修改这里
}
```

#### 重构方案

**步骤 1**: 定义 Step Handler 接口

```typescript
// packages/backend/src/services/pipeline/step-handler.ts
import type { PipelineContext, StepResult } from './types.js'

export interface PipelineStepHandler {
  /** 步骤名称 */
  readonly step: string

  /** 执行步骤 */
  execute(context: PipelineContext): Promise<StepResult>

  /** 是否需要前置步骤的结果 */
  requiresPreviousResults(): boolean
}
```

**步骤 2**: 实现具体步骤

```typescript
// packages/backend/src/services/pipeline/steps/episode-splitting.ts
import type { PipelineStepHandler, PipelineContext, StepResult } from '../types.js'
import { splitEpisodesFromScript } from '../../episode-splitter.js'

export class EpisodeSplittingStep implements PipelineStepHandler {
  readonly step = 'episode-splitting'

  async execute(context: PipelineContext): Promise<StepResult> {
    const script = context.previousResults.script
    if (!script) {
      return {
        step: this.step,
        status: 'failed',
        error: 'Missing script from previous step'
      }
    }

    try {
      const episodes = await splitEpisodesFromScript(script, {
        targetEpisodes: context.targetEpisodes,
        targetDuration: context.targetDuration
      })

      return {
        step: this.step,
        status: 'success',
        data: { episodes }
      }
    } catch (error) {
      return {
        step: this.step,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  requiresPreviousResults(): boolean {
    return true // 需要 script 步骤的结果
  }
}
```

**步骤 3**: 创建 Step Registry

```typescript
// packages/backend/src/services/pipeline/step-registry.ts
import type { PipelineStepHandler } from './step-handler.js'

class PipelineStepRegistry {
  private steps = new Map<string, PipelineStepHandler>()

  register(handler: PipelineStepHandler): void {
    this.steps.set(handler.step, handler)
  }

  getStep(step: string): PipelineStepHandler | undefined {
    return this.steps.get(step)
  }

  listSteps(): string[] {
    return Array.from(this.steps.keys())
  }
}

export const pipelineStepRegistry = new PipelineStepRegistry()

// 注册所有步骤
export function registerDefaultSteps(): void {
  import('./steps/episode-splitting.js').then((mod) => {
    pipelineStepRegistry.register(new mod.EpisodeSplittingStep())
  })
  // 注册其他步骤...
}
```

**步骤 4**: 重构 Orchestrator

```typescript
// packages/backend/src/services/pipeline-orchestrator.ts (重构后)
import { pipelineStepRegistry } from './pipeline/step-registry.js'

export class PipelineOrchestrator {
  async executeStep(step: string, context: PipelineContext): Promise<StepResult> {
    const handler = pipelineStepRegistry.getStep(step)

    if (!handler) {
      const available = pipelineStepRegistry.listSteps().join(', ')
      return {
        step,
        status: 'failed',
        error: `Unknown step: ${step}. Available: ${available}`
      }
    }

    if (handler.requiresPreviousResults() && !context.previousResults) {
      return {
        step,
        status: 'failed',
        error: `Step '${step}' requires previous results`
      }
    }

    return await handler.execute(context)
  }
}
```

#### 验收标准

- [ ] 可以通过注册新 Handler 添加步骤
- [ ] 现有 pipeline 功能不受影响
- [ ] 错误消息包含可用步骤列表
- [ ] 单元测试覆盖注册和执行流程

---

### Phase 4: Medium - 其他优化

**优先级**: 🟡 Medium  
**预计工时**: 1.5 小时

#### 4.1 添加 OperationContext 类型

```typescript
// packages/shared/src/types/operation-context.ts
export interface OperationContext {
  userId: string
  projectId: string
  op: string
}

// 使用示例
async function generateScript(context: OperationContext, episodeId: string) {
  // 替代 (userId: string, projectId: string, op: string)
}
```

#### 4.2 重命名不清晰的变量

| 文件                     | 当前                 | 改为                          |
| ------------------------ | -------------------- | ----------------------------- |
| `project-script-jobs.ts` | `const n = await...` | `const jobCount = await...`   |
| `image-generation.ts`    | `const d = data`     | `const generationData = data` |
| `episode-service.ts`     | `const ep = episode` | `const episodeData = episode` |

#### 4.3 提取 Prompt Builders

```typescript
// packages/backend/src/services/prompts/scene-prompt-builder.ts
export class ScenePromptBuilder {
  private parts: string[] = []

  withTitle(title: string): this {
    this.parts.push(title)
    return this
  }

  withLocation(location?: string): this {
    if (location) this.parts.push(location)
    return this
  }

  withDialogues(dialogues?: Dialogue[]): this {
    if (dialogues?.length) {
      this.parts.push(dialogues.map((d) => `${d.character}: ${d.content}`).join(' '))
    }
    return this
  }

  build(): string {
    return this.parts.filter(Boolean).join(', ')
  }
}

// 使用
const prompt = new ScenePromptBuilder()
  .withTitle(scriptTitle)
  .withLocation(scene.location)
  .withDialogues(scene.dialogues)
  .build()
```

---

## 📅 实施计划

### Week 1: Foundation (4 hours)

**Day 1-2**: Phase 1 - LLM Factory Registry

- [ ] 创建 `llm-registry.ts`
- [ ] 更新 `llm-factory.ts` 使用 registry
- [ ] 编写单元测试
- [ ] 验证现有功能

**Day 3-4**: Phase 2 Part 1 - Script Processing 拆分

- [ ] 创建 `script-processing/` 目录
- [ ] 实现 `ScriptModeRouter`
- [ ] 实现 `FirstEpisodeGenerator`
- [ ] 添加向后兼容的 re-export

### Week 2: Core Refactoring (4 hours)

**Day 1-2**: Phase 2 Part 2 - 完成拆分

- [ ] 实现 `BatchEpisodeGenerator`
- [ ] 实现 `ScriptParser`
- [ ] 更新所有导入路径
- [ ] 运行全量测试

**Day 3**: Phase 3 - Pipeline Strategy

- [ ] 创建 `PipelineStepHandler` 接口
- [ ] 实现 2-3 个示例步骤
- [ ] 创建 Step Registry
- [ ] 重构 Orchestrator

**Day 4**: Phase 4 - 其他优化

- [ ] 添加 `OperationContext` 类型
- [ ] 重命名变量
- [ ] 提取 Prompt Builder（可选）

### Week 3: Testing & Cleanup (1.5 hours)

- [ ] 补充所有新模块的单元测试
- [ ] 运行全量测试套件
- [ ] 更新文档
- [ ] 代码审查
- [ ] 清理 deprecated 警告

---

## ⚠️ 风险与缓解

| 风险         | 影响   | 缓解措施                                 |
| ------------ | ------ | ---------------------------------------- |
| 重构引入 bug | High   | 渐进式重构，保持向后兼容，充分测试       |
| 破坏现有 API | High   | 保留 re-export，添加 deprecation warning |
| 耗时超预期   | Medium | 分阶段实施，优先高价值重构               |
| 合并冲突     | Medium | 小步提交，及时同步 main 分支             |

---

## 📊 成功指标

### 代码质量指标

| 指标            | 当前    | 目标               |
| --------------- | ------- | ------------------ |
| 最大文件行数    | 586 行  | < 400 行           |
| 平均函数行数    | ~100 行 | < 50 行            |
| Switch 语句数量 | 12 个   | < 5 个（关键路径） |
| 单元测试覆盖率  | ~75%    | > 85%              |

### 可维护性指标

- ✅ 添加新 LLM provider 不需要修改现有代码（OCP）
- ✅ 添加新 Pipeline 步骤只需注册 Handler（OCP）
- ✅ 每个文件职责清晰、单一（SRP）
- ✅ 复杂工作流有 Facade 简化接口

---

## 🔗 相关文档

- [CodeReview_CleanCode_Audit_20260422.md](./CodeReview_CleanCode_Audit_20260422.md) - 完整代码审查报告
- [CODING_STANDARDS.md](../CODING_STANDARDS.md) - 编码规范
- [.qoder/skills/clean-code-and-patterns/SKILL.md](../../.qoder/skills/clean-code-and-patterns/SKILL.md) - Clean Code Skill

---

## 👥 负责人与审核

- **执行人**: AI Agent + Developer
- **代码审核**: 需要人工 Review
- **测试验证**: 全量测试套件通过

---

**状态**: 📋 计划阶段  
**下一步**: 获得批准后开始 Phase 1 实施
