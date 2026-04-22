---
name: clean-code-and-patterns
description: Apply SOLID principles, design patterns, and clean code practices to the Dreamer project. Covers SOLID (SRP, OCP, LSP, ISP, DIP), GoF patterns (Factory, Strategy, Observer, Repository, etc.), code review architecture, and tech-specific guidance for Fastify + Prisma + Vue 3 + TypeScript. Use when writing new code, refactoring, reviewing PRs, or discussing architecture decisions.
---

# Clean Code & Design Patterns for Dreamer

Comprehensive guide for writing maintainable, scalable code in the Dreamer AI short drama platform. Combines universal principles with project-specific patterns for Fastify + Prisma + Vue 3 + TypeScript stack.

## When to Apply

- Writing new features or services
- Refactoring existing code
- Reviewing pull requests
- Designing system architecture
- Discussing technical decisions

---

## 1. SOLID Principles (CRITICAL)

### SRP - Single Responsibility Principle

**Rule**: Each module/class/service has one reason to change.

```typescript
// ✅ Good: Focused service
class LocationService {
  async generateImagePrompt(location: Location): Promise<string> { ... }
  async updateLocationImage(id: string, url: string): Promise<Location> { ... }
}

// ❌ Bad: Mixed concerns
class LocationService {
  async generateImagePrompt(location: Location): Promise<string> { ... }
  async sendNotification(userId: string): Promise<void> { ... } // Notification is different responsibility
  async logAnalytics(event: string): Promise<void> { ... } // Analytics is different responsibility
}
```

**Dreamer Application**:

- `routes/` → Only route registration and auth
- `handlers/` → Request parsing, service calls, response mapping
- `services/` → Business logic and external API calls
- `repositories/` → Only Prisma data access

### OCP - Open/Closed Principle

**Rule**: Open for extension, closed for modification.

```typescript
// ✅ Good: Extensible via interfaces
interface TTSProvider {
  name: string
  synthesize(text: string, voiceId: string): Promise<string>
  getVoiceId(config: VoiceConfig): string
}

class AliyunTTSProvider implements TTSProvider { ... }
class VolcanoTTSProvider implements TTSProvider { ... }

// Adding new provider doesn't modify existing code
class NewTTSProvider implements TTSProvider { ... }

// ❌ Bad: Requires modification to extend
class TTSProvider {
  async synthesize(platform: 'aliyun' | 'volcano', text: string) {
    if (platform === 'aliyun') { ... }
    if (platform === 'volcano') { ... }
    // Must modify this method to add new platform
  }
}
```

### LSP - Liskov Substitution Principle

**Rule**: Subtypes must be substitutable for base types without breaking behavior.

```typescript
// ✅ Good: Subtypes honor the contract
interface VideoGenerator {
  generate(prompt: string): Promise<string> // Returns video URL
}

class SeedanceGenerator implements VideoGenerator {
  async generate(prompt: string): Promise<string> {
    // Returns valid URL or throws
  }
}

class Wan26Generator implements VideoGenerator {
  async generate(prompt: string): Promise<string> {
    // Returns valid URL or throws
  }
}

// ❌ Bad: Subtype changes return contract
class BrokenGenerator implements VideoGenerator {
  async generate(prompt: string): Promise<string | null> {
    // Returns null instead of throwing - breaks client expectations
  }
}
```

### ISP - Interface Segregation Principle

**Rule**: Don't force clients to depend on unused methods.

```typescript
// ✅ Good: Focused interfaces
interface ImageGenerator {
  generate(prompt: string): Promise<string>
}

interface ImageEditor {
  edit(imageUrl: string, editPrompt: string): Promise<string>
}

// Services implement only what they need
class SeedreamService implements ImageGenerator { ... }

// ❌ Bad: Fat interface
interface ImageService {
  generate(prompt: string): Promise<string>
  edit(imageUrl: string, editPrompt: string): Promise<string>
  upscale(imageUrl: string): Promise<string>
  removeBackground(imageUrl: string): Promise<string>
}
```

### DIP - Dependency Inversion Principle

**Rule**: Depend on abstractions, not concretions.

```typescript
// ✅ Good: Depends on abstraction
class CharacterImageService {
  constructor(
    private repository: CharacterRepository, // Interface, not Prisma directly
    private imageGenerator: ImageGenerator // Interface
  ) {}

  async generateCharacterImage(characterId: string): Promise<string> {
    const character = await this.repository.findById(characterId)
    const prompt = this.buildPrompt(character)
    return await this.imageGenerator.generate(prompt)
  }
}

// ❌ Bad: Depends on concrete implementation
class CharacterImageService {
  private prisma = new PrismaClient() // Hard dependency
  private seedream = new SeedreamClient() // Hard dependency

  async generateCharacterImage(characterId: string): Promise<string> {
    // Tightly coupled to specific implementations
  }
}
```

---

## 2. Core Principles (CRITICAL)

### DRY - Don't Repeat Yourself

```typescript
// ✅ Good: Single source of truth
const JOB_TYPE_LABELS: Record<string, string> = {
  video: '视频生成',
  import: '剧本导入',
  pipeline: '流水线任务',
  image: '图片生成',
  'episode-storyboard-script': 'AI生成分镜脚本'
}

function getJobTypeLabel(type: string): string {
  return JOB_TYPE_LABELS[type] ?? type
}

// ❌ Bad: Duplicated across files
// File 1: const label = type === 'video' ? '视频生成' : ...
// File 2: if (type === 'video') return '视频生成'
```

### KISS - Keep It Simple

```typescript
// ✅ Good: Simple and clear
async function getCharacterWithImages(id: string) {
  return await prisma.character.findUnique({
    where: { id },
    include: { images: true }
  })
}

// ❌ Bad: Over-engineered
async function getCharacterWithImages(id: string) {
  const factory = new CharacterQueryFactory()
  const strategy = new EagerLoadingStrategy()
  const builder = new QueryBuilder(strategy)
  const query = factory.createQuery(builder)
  return await query.execute(id)
}
```

### YAGNI - You Aren't Gonna Need It

Don't add features "just in case". Build what's needed now, design for extension later.

### Composition Over Inheritance

```typescript
// ✅ Good: Composition
class EpisodeService {
  constructor(
    private repository: EpisodeRepository,
    private validator: EpisodeValidator,
    private eventEmitter: EventEmitter
  ) {}
}

// ❌ Bad: Deep inheritance
class BaseService { ... }
class CRUDService extends BaseService { ... }
class EpisodeService extends CRUDService { ... }
class AIEnhancedEpisodeService extends EpisodeService { ... }
```

---

## 3. Design Patterns (HIGH)

### Repository Pattern (Data Access)

Already used in Dreamer architecture. Centralizes Prisma queries.

```typescript
// packages/backend/src/repositories/character-repository.ts
export class CharacterRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Character | null> {
    return await this.prisma.character.findUnique({
      where: { id },
      include: { images: true, project: true }
    })
  }

  async findManyByProject(projectId: string): Promise<Character[]> {
    return await this.prisma.character.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' }
    })
  }

  async create(data: Prisma.CharacterCreateInput): Promise<Character> {
    return await this.prisma.character.create({ data })
  }
}
```

**Benefits**:

- Single place for data access logic
- Easy to mock in tests
- Can add caching, logging, etc. without touching services

### Strategy Pattern (Algorithm Selection)

Perfect for multiple AI providers (TTS, image generation, video).

```typescript
// packages/backend/src/services/tts/
interface TTSProvider {
  name: string
  synthesize(text: string, voiceId: string): Promise<string>
}

class AliyunTTSProvider implements TTSProvider { ... }
class VolcanoTTSProvider implements TTSProvider { ... }

// Strategy selector
function getTTSProvider(platform: TTSPlatform): TTSProvider {
  const providers = {
    aliyun: new AliyunTTSProvider(),
    volcano: new VolcanoTTSProvider()
  }
  return providers[platform]
}
```

### Factory Pattern (Object Creation)

Use for complex object creation with variations.

```typescript
// Factory for different job types
class JobFactory {
  static createJob(type: JobType, data: JobData): Job {
    switch (type) {
      case 'video':
        return new VideoJob(data)
      case 'image':
        return new ImageJob(data)
      case 'pipeline':
        return new PipelineJob(data)
      default:
        throw new Error(`Unknown job type: ${type}`)
    }
  }
}
```

### Observer Pattern (Event Handling)

Use for decoupled event-driven architecture.

```typescript
// EventEmitter for async events
const eventEmitter = new EventEmitter()

// Subscribe
eventEmitter.on('job:completed', async (job: Job) => {
  await notifyUser(job.userId, `Job ${job.id} completed`)
  await updateMetrics(job)
})

// Publish
eventEmitter.emit('job:completed', job)
```

### Adapter Pattern (Interface Conversion)

Use when integrating external APIs with different interfaces.

```typescript
// Adapter for DeepSeek's OpenAI-compatible API
class DeepSeekAdapter implements LLMProvider {
  constructor(private client: OpenAI) {} // Uses OpenAI SDK

  async chat(messages: Message[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat',
      messages
    })
    return response.choices[0].message.content ?? ''
  }
}
```

### Facade Pattern (Simplified Interface)

Provide simple interface to complex subsystem.

```typescript
// Facade for AI script generation
class ScriptGenerationFacade {
  constructor(
    private llm: LLMService,
    private memoryService: MemoryService,
    private validator: ScriptValidator
  ) {}

  async generateEpisodeScript(episodeId: string): Promise<Script> {
    // Complex workflow hidden behind simple interface
    const episode = await this.getEpisode(episodeId)
    const context = await this.memoryService.getEpisodeContext(episodeId)
    const prompt = this.buildPrompt(episode, context)
    const rawScript = await this.llm.generate(prompt)
    return this.validator.validateAndFormat(rawScript)
  }
}
```

---

## 4. Code Organization (HIGH)

### Feature-Based Module Structure

```
packages/backend/src/services/
├── ai/                      # AI model integration
│   ├── deepseek-client.ts   # HTTP client
│   ├── deepseek.ts          # Business logic
│   ├── seedance.ts          # Video generation
│   └── index.ts             # Re-exports
├── tts/                     # Text-to-speech
│   ├── base.ts              # Interface
│   ├── aliyun.ts            # Implementation
│   ├── volcano.ts           # Implementation
│   └── index.ts
└── location-image.ts        # Single-file module (simple)
```

### Dependency Flow

```
routes → handlers → services → repositories → Prisma
         ↑              ↑
      (thin)        (business logic)
```

**Rules**:

- Never skip layers (routes shouldn't call repositories directly)
- No circular dependencies
- Services can call other services, but be careful of coupling

---

## 5. Naming Conventions (MEDIUM)

### Function Prefixes

| Prefix                 | Meaning              | Example                       |
| ---------------------- | -------------------- | ----------------------------- |
| `get`                  | Synchronous read     | `getCharacterById`            |
| `fetch`                | Async external fetch | `fetchProjectList`            |
| `find`                 | Search, may be null  | `findLocationByName`          |
| `generate`             | Create (incl. AI)    | `generateLocationImagePrompt` |
| `call`                 | External API call    | `callSeedreamGenerate`        |
| `create/update/delete` | Persistence          | `updateLocationImageUrl`      |
| `handle`               | Event handler        | `handleGenerateClick`         |
| `validate`             | Validation           | `validateProjectName`         |
| `build`                | Complex assembly     | `buildSeedanceRequest`        |

### Suffixes

| Suffix               | Purpose                | Example              |
| -------------------- | ---------------------- | -------------------- |
| `Service`            | Business orchestration | `LocationService`    |
| `Repository`         | Data access            | `LocationRepository` |
| `Client`             | External HTTP/SDK      | `DeepSeekClient`     |
| `Controller`         | HTTP adapter           | `LocationController` |
| `Input/Response/Dto` | Data transfer          | `GenerateImageInput` |

---

## 6. Fastify-Specific Patterns

### Route Handler Pattern

```typescript
// routes/location-routes.ts
export async function locationRoutes(fastify: FastifyInstance) {
  fastify.post('/api/locations', {
    preHandler: [fastify.authenticate],
    schema: { ... }
  }, async (request, reply) => {
    const userId = getRequestUserId(request)
    const data = request.body as CreateLocationInput

    const location = await fastify.locationService.create(userId, data)
    return reply.code(201).send({ success: true, data: location })
  })
}
```

### Error Handling

```typescript
// Use Fastify's error handler
fastify.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, 'Request error')

  if (error instanceof ValidationError) {
    return reply.code(400).send({ success: false, error: error.message })
  }

  if (error instanceof AIGenerationError) {
    return reply.code(502).send({ success: false, error: 'AI generation failed' })
  }

  return reply.code(500).send({ success: false, error: 'Internal server error' })
})
```

---

## 7. Prisma Best Practices

### Select Only Needed Fields

```typescript
// ✅ Good: Explicit select
const projects = await prisma.project.findMany({
  select: {
    id: true,
    name: true,
    coverUrl: true,
    createdAt: true
  }
})

// ❌ Bad: Returns all fields (including sensitive data)
const projects = await prisma.project.findMany()
```

### Avoid N+1 Queries

```typescript
// ✅ Good: Single query with include
const episodes = await prisma.episode.findMany({
  where: { projectId },
  include: {
    scenes: true,
    scripts: true
  }
})

// ❌ Bad: N+1 queries
const episodes = await prisma.episode.findMany({ where: { projectId } })
for (const episode of episodes) {
  episode.scenes = await prisma.scene.findMany({ where: { episodeId: episode.id } })
}
```

### Use Transactions for Multi-Table Writes

```typescript
await prisma.$transaction(async (tx) => {
  const episode = await tx.episode.create({ data: episodeData })
  await tx.scene.createMany({
    data: scenes.map((scene) => ({ ...scene, episodeId: episode.id }))
  })
})
```

---

## 8. Vue 3 Composition API Patterns

### Composable Pattern

```typescript
// composables/usePolling.ts
export function usePolling<T>(fetchFn: () => Promise<T>, intervalMs: number = 3000) {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const startPolling = () => {
    const timer = setInterval(async () => {
      try {
        loading.value = true
        data.value = await fetchFn()
        error.value = null
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Unknown error'
      } finally {
        loading.value = false
      }
    }, intervalMs)

    onUnmounted(() => clearInterval(timer))
  }

  return { data, loading, error, startPolling }
}
```

### State Management Pattern

```typescript
// stores/project-store.ts
export const useProjectStore = defineStore('project', {
  state: () => ({
    currentProject: null as Project | null,
    loading: false,
    error: null as string | null
  }),

  actions: {
    async loadProject(id: string) {
      this.loading = true
      try {
        this.currentProject = await fetchProject(id)
        this.error = null
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load'
        throw err
      } finally {
        this.loading = false
      }
    }
  }
})
```

---

## Code Review Checklist

When reviewing code, check for:

### SOLID Violations

- [ ] Class/service has multiple responsibilities?
- [ ] Adding feature requires modifying existing code (vs. extending)?
- [ ] Subtypes break base type contracts?
- [ ] Fat interfaces with unused methods?
- [ ] High-level modules depend on low-level details?

### Clean Code

- [ ] Functions > 50 lines doing multiple things?
- [ ] Functions with > 3 parameters (should use object)?
- [ ] Unjustified `any` types?
- [ ] Magic numbers/strings not extracted to constants?
- [ ] Empty catch blocks or swallowed errors?
- [ ] Meaningless names (`data`, `temp`, `handleStuff`)?

### Design Patterns

- [ ] Repeating conditional logic → Strategy pattern?
- [ ] Complex creation logic → Factory pattern?
- [ ] Tight coupling between modules → Dependency injection?
- [ ] Duplicated data access → Repository pattern?
- [ ] Event-driven communication needed → Observer pattern?

### Tech Stack

- [ ] Fastify routes contain business logic?
- [ ] Prisma queries fetch unnecessary fields?
- [ ] N+1 queries in loops?
- [ ] Missing `bootstrap-env.js` import in entry files?
- [ ] Vue components with > 200 lines (extract composables)?
- [ ] AI model calls missing `ModelApiCall` logging?

---

## Additional Resources

For detailed explanations and more examples:

- Project coding standards: [docs/CODING_STANDARDS.md](../../docs/CODING_STANDARDS.md)
- Code review checklist: [docs/CODE_REVIEW_CHECKLIST.md](../../docs/CODE_REVIEW_CHECKLIST.md)
- Architecture overview: [.qoder/repowiki/en/content/Architecture Overview/](../../.qoder/repowiki/en/content/Architecture%20Overview/)
