# Code Review Report - Clean Code & Design Patterns Audit

**Date**: 2026-04-22  
**Scope**: Backend services layer (`packages/backend/src/services/`)  
**Standard**: [clean-code-and-patterns skill](.qoder/skills/clean-code-and-patterns/SKILL.md) + [CODING_STANDARDS.md](docs/CODING_STANDARDS.md)

---

## Executive Summary

**Overall Code Quality**: 🟢 **Good** (7.5/10)

The codebase demonstrates strong adherence to modern TypeScript practices:

- ✅ No explicit `any` types found
- ✅ No empty catch blocks
- ✅ Good use of dependency injection in services
- ✅ Well-organized module structure

**Key Areas for Improvement**:

1. 🔴 **SRP violations** in large service files (500+ lines)
2. 🟠 **OCP violations** in switch statements (12 instances)
3. 🟡 **Feature Envy** patterns detected
4. 🔵 **Missing Factory/Strategy patterns** where switch statements dominate

---

## 1. SOLID Principles Audit

### ✅ SRP - Single Responsibility Principle

#### Issues Found

| File                     | Lines | Problem                                                               | Severity  |
| ------------------------ | ----- | --------------------------------------------------------------------- | --------- |
| `project-script-jobs.ts` | 586   | Handles first episode, batch, parsing, AI creation, memory extraction | 🔴 High   |
| `episode-service.ts`     | 541   | Manages episodes, scripts, scenes, shots, composition, memory         | 🔴 High   |
| `script-writer.ts`       | 467   | Writes scripts, expands, improves, optimizes                          | 🟠 Medium |

**Example - project-script-jobs.ts**:

```typescript
// ❌ Bad: Too many responsibilities
export async function runGenerateFirstEpisode(projectId: string, targetEpisodes?: number) {
  // 1. Detect script mode
  // 2. Parse faithful script
  // 3. Run mixed mode
  // 4. Format script to JSON
  // 5. Save memories
  // 6. Update project
  // 7. Handle errors
  // ... (200+ lines)
}
```

**Recommended Fix**:

```typescript
// ✅ Good: Split by responsibility
class ScriptModeRouter {
  route(project: Project): ScriptProcessor {
    const mode = detectScriptMode(project.description)
    return mode === 'faithful-parse' ? new FaithfulParseProcessor() : new MixedModeProcessor()
  }
}

class FirstEpisodeGenerator {
  constructor(
    private router: ScriptModeRouter,
    private saver: EpisodeSaver,
    private memoryExtractor: MemoryExtractor
  ) {}

  async generate(projectId: string): Promise<Episode> {
    // Orchestrate only, delegate work
  }
}
```

**Action Items**:

- [ ] Split `project-script-jobs.ts` into:
  - `script-mode-router.ts` - Mode detection and routing
  - `first-episode-generator.ts` - First episode orchestration
  - `batch-episode-generator.ts` - Batch processing
  - `script-parser-orchestrator.ts` - Parsing coordination

---

### ✅ OCP - Open/Closed Principle

#### Issues Found

| Location                                 | Pattern                    | Problem                               | Severity  |
| ---------------------------------------- | -------------------------- | ------------------------------------- | --------- |
| `pipeline-orchestrator.ts:239`           | `switch (step)`            | Must modify to add new pipeline steps | 🟠 Medium |
| `image-generation-job-service.ts:33,107` | `switch (data.kind)`       | Must modify to add new job kinds      | 🟠 Medium |
| `ai/llm-factory.ts:18`                   | `switch (config.provider)` | Must modify to add new LLM providers  | 🟠 Medium |
| `queues/pipeline.ts:67`                  | `switch (jobType)`         | Must modify to add new job types      | 🟡 Low    |

**Example - llm-factory.ts**:

```typescript
// ❌ Bad: Violates OCP
export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider.toLowerCase()) {
    case 'deepseek':
      return new DeepSeekProvider(config)
    case 'openai':
      throw new Error('OpenAI provider not yet implemented')
    case 'claude':
      throw new Error('Claude provider not yet implemented')
    // Must add new case for each provider
  }
}
```

**Recommended Fix** (Registry Pattern):

```typescript
// ✅ Good: Open for extension
const providerRegistry = new Map<string, LLMProviderFactory>()

export function registerProvider(name: string, factory: LLMProviderFactory) {
  providerRegistry.set(name.toLowerCase(), factory)
}

export function createLLMProvider(config: LLMConfig): LLMProvider {
  const factory = providerRegistry.get(config.provider.toLowerCase())
  if (!factory) {
    throw new Error(`Unknown LLM provider: ${config.provider}`)
  }
  return factory.create(config)
}

// Register at startup
registerProvider('deepseek', (config) => new DeepSeekProvider(config))
registerProvider('openai', (config) => new OpenAIProvider(config))
// Adding new provider? Just register it!
```

**Action Items**:

- [ ] Refactor `llm-factory.ts` to use registry pattern
- [ ] Refactor `pipeline-orchestrator.ts` step handling to Strategy pattern
- [ ] Consider if job kind switches need refactoring (lower priority)

---

### ✅ LSP - Liskov Substitution Principle

#### Status: 🟢 Good

No violations found. All interface implementations honor their contracts:

- `TTSProvider` implementations (Aliyun, Volcano) return consistent types
- `ImageGenerator` implementations throw errors consistently
- Service interfaces have clear contracts

---

### ✅ ISP - Interface Segregation Principle

#### Status: 🟢 Good

Interfaces are focused and cohesive:

- `TTSProvider` has only 3 methods
- `ImageQueueAdapter` is specific to image queuing
- Repository interfaces are data-access focused

---

### ✅ DIP - Dependency Inversion Principle

#### Status: 🟢 Excellent

Strong adherence across the codebase:

```typescript
// ✅ Good: Depends on abstractions
export class EpisodeService {
  constructor(private readonly repo: EpisodeRepository) {}
  // ...
}

export class LocationService {
  constructor(
    private readonly repository: LocationRepository,
    private readonly queue: ImageQueueAdapter
  ) {}
}
```

---

## 2. Design Patterns Audit

### 🔍 Strategy Pattern - Partial Implementation

**Current State**: Some services use Strategy pattern well (TTS providers), but others use switch statements.

**Opportunities**:

| Area           | Current                         | Recommended                        |
| -------------- | ------------------------------- | ---------------------------------- |
| Pipeline Steps | `switch (step)` in orchestrator | `StepHandler` interface + registry |
| Script Modes   | Conditional routing             | `ScriptProcessor` strategy         |
| LLM Providers  | Factory with switch             | Registry pattern                   |

### 🔍 Repository Pattern - ✅ Well Implemented

All data access is properly abstracted:

- `EpisodeRepository`, `CharacterRepository`, `LocationRepository`, etc.
- Services depend on repository interfaces
- Easy to mock in tests

### 🔍 Facade Pattern - Missing

**Issue**: Complex workflows are exposed directly in services.

**Example**:

```typescript
// episode-service.ts handles:
// 1. Script writing
// 2. Scene creation
// 3. Shot generation
// 4. Memory extraction
// 5. Composition export
```

**Recommended**: Create facades for complex workflows:

```typescript
class EpisodeGenerationFacade {
  constructor(
    private scriptWriter: ScriptWriter,
    private sceneCreator: SceneCreator,
    private shotGenerator: ShotGenerator,
    private memoryExtractor: MemoryExtractor
  ) {}

  async generateEpisode(episodeId: string): Promise<EpisodeResult> {
    // Orchestrate complex workflow behind simple interface
  }
}
```

### 🔍 Factory Pattern - Partial

**Current**: `llm-factory.ts` exists but uses switch instead of registry.

**Recommendation**: Upgrade to Abstract Factory with registration (see OCP section above).

---

## 3. Code Smells Detected

### 🔴 God Object

| File                     | Lines | Responsibilities                         | Fix                            |
| ------------------------ | ----- | ---------------------------------------- | ------------------------------ |
| `project-script-jobs.ts` | 586   | 7+ distinct concerns                     | Split into 4-5 focused modules |
| `episode-service.ts`     | 541   | Episode + Script + Scene + Shot + Memory | Extract script/scene logic     |

### 🟠 Feature Envy

**Example**: `episode-service.ts` knows too much about script parsing:

```typescript
// ❌ EpisodeService handles script parsing details
private async applyScriptContentToEpisode(
  episodeId: string,
  projectId: string,
  episodeTitle: string | null | undefined,
  script: ScriptContent  // Knows ScriptContent structure
): Promise<...> {
  // Parses scenes, characters, dialogues from script
  // Should delegate to ScriptProcessor
}
```

**Fix**: Move script-specific logic to `ScriptProcessor` or `ScriptApplicationService`.

### 🟡 Long Method

| File                     | Function                    | Lines  | Recommendation                         |
| ------------------------ | --------------------------- | ------ | -------------------------------------- |
| `project-script-jobs.ts` | `runGenerateFirstEpisode`   | ~200   | Extract mode-specific logic            |
| `episode-service.ts`     | `expandEpisode`             | ~150   | Split AI call, DB save, scene creation |
| `script-writer.ts`       | `buildUserPrompt` (various) | ~50-80 | OK, but could extract prompt builders  |

### 🟡 Data Clumps

**Example**: Repeated parameter groups:

```typescript
// Seen in multiple places
async function someFunction(userId: string, projectId: string, op: string)
```

**Fix**: Create context object:

```typescript
interface OperationContext {
  userId: string
  projectId: string
  op: string
}
```

---

## 4. TypeScript Best Practices

### ✅ Type Safety

- **No `any` types found** - Excellent!
- Proper use of discriminated unions for result types
- Good use of `as const` for constants

### ✅ Error Handling

- No empty catch blocks
- Proper error classification (`classifyAIError`)
- Good use of custom error types

### 🟡 Naming Conventions

**Minor Issues**:

```typescript
// Could be more descriptive
const n = await pipelineRepository.countOutlineAsyncJobs(projectId)
// Better: const jobCount = ...

const d = data // In image-generation.ts
// Better: const generationData = ...
```

---

## 5. Priority Recommendations

### 🔴 Critical (Do Next Sprint)

1. **Split `project-script-jobs.ts`**
   - Impact: High (586 lines, hard to maintain)
   - Effort: Medium (2-3 hours)
   - Pattern: Extract Class + Strategy

2. **Refactor LLM Factory to Registry**
   - Impact: High (enables easy provider addition)
   - Effort: Low (1 hour)
   - Pattern: Registry + Factory

### 🟠 High (Do This Month)

3. **Extract Episode Script Logic**
   - Move script parsing from `EpisodeService` to dedicated service
   - Pattern: Facade + SRP

4. **Pipeline Step Strategy Pattern**
   - Replace switch with `StepHandler` registry
   - Pattern: Strategy

### 🟡 Medium (Backlog)

5. **Add Operation Context Type**
   - Replace repeated `(userId, projectId, op)` params
   - Pattern: Value Object

6. **Rename Unclear Variables**
   - `n` → `jobCount`
   - `d` → `generationData`

### 🔵 Low (Nice to Have)

7. **Consider Extracting Prompt Builders**
   - Separate classes for prompt construction
   - Pattern: Builder

---

## 6. Positive Patterns Found

✅ **Excellent DI Usage**:

```typescript
class CharacterService {
  constructor(private readonly repository: CharacterRepository) {}
}
```

✅ **Good Result Types**:

```typescript
export type ComposeEpisodeResult =
  | { ok: true; compositionId: string; outputUrl: string; duration: number }
  | { ok: false; status: 400; error: string; details?: string[] }
  | { ok: false; status: 404; error: string }
```

✅ **Proper Error Classification**:

```typescript
const errorClassification = classifyAIError(error)
if (errorClassification.retryable) {
  // Can retry
}
```

✅ **Clean Module Structure**:

```
services/
├── ai/          # AI integration
├── memory/      # Memory system
├── prompts/     # Prompt templates
├── tts/         # TTS providers
└── *.ts         # Domain services
```

---

## 7. Estimated Refactoring Effort

| Task                         | Effort  | Risk   | Priority    |
| ---------------------------- | ------- | ------ | ----------- |
| Split project-script-jobs.ts | 3 hours | Medium | 🔴 Critical |
| Refactor LLM Factory         | 1 hour  | Low    | 🔴 Critical |
| Extract Episode script logic | 2 hours | Medium | 🟠 High     |
| Pipeline Step Strategy       | 2 hours | Medium | 🟠 High     |
| Add Operation Context        | 1 hour  | Low    | 🟡 Medium   |
| Rename variables             | 30 min  | Low    | 🟡 Medium   |

**Total**: ~9.5 hours for full refactoring

---

## Summary

The Dreamer codebase is **well-structured** with strong fundamentals:

- ✅ Excellent dependency injection
- ✅ No type safety issues
- ✅ Good error handling
- ✅ Clean module organization

**Main opportunities**:

1. Apply SRP to large orchestrator files
2. Replace switch statements with Strategy/Registry patterns
3. Extract facades for complex workflows

These improvements will make the codebase:

- Easier to test (smaller, focused units)
- Easier to extend (OCP via patterns)
- Easier to maintain (clear responsibilities)

---

**Reviewed by**: AI Code Review (clean-code-and-patterns skill)  
**Next Review**: After refactoring sprint
