# Real-World Examples from Dreamer Project

Practical examples showing how to apply SOLID principles and design patterns in the actual Dreamer codebase.

---

## Example 1: TTS Provider Refactoring (Strategy + OCP)

### Before: Tightly Coupled Implementation

```typescript
// ❌ Bad: Hard to add new TTS providers
class VoiceService {
  async synthesize(text: string, platform: 'aliyun' | 'volcano', voiceConfig: VoiceConfig) {
    if (platform === 'aliyun') {
      const voiceId = this.mapAliyunVoice(voiceConfig)
      const response = await fetch('https://nls-meta.cn-shanghai.aliyuncs.com', {
        method: 'POST',
        body: JSON.stringify({ text, voice: voiceId })
      })
      return await response.json()
    }

    if (platform === 'volcano') {
      const voiceId = this.mapVolcanoVoice(voiceConfig)
      const response = await fetch('https://openspeech.bytedance.com', {
        method: 'POST',
        body: JSON.stringify({ text, voice: voiceId })
      })
      return await response.json()
    }

    throw new Error('Unknown platform')
  }

  private mapAliyunVoice(config: VoiceConfig): string {
    // Aliyun-specific mapping logic
  }

  private mapVolcanoVoice(config: VoiceConfig): string {
    // Volcano-specific mapping logic
  }
}
```

**Problems**:

- Violates OCP: Must modify `synthesize()` to add new provider
- Violates SRP: Handles both synthesis and voice mapping
- Hard to test: Can't test each provider in isolation
- Duplicated code: Similar fetch patterns

### After: Strategy Pattern

```typescript
// ✅ Good: Easy to extend

// 1. Define interface
interface TTSProvider {
  name: string
  synthesize(text: string, voiceId: string): Promise<string>
  getVoiceId(config: VoiceConfig): string
}

// 2. Implement providers separately
class AliyunTTSProvider implements TTSProvider {
  name = 'aliyun'
  private client: AliyunClient

  async synthesize(text: string, voiceId: string): Promise<string> {
    return await this.client.synthesize({ text, voice: voiceId })
  }

  getVoiceId(config: VoiceConfig): string {
    return ALIYUN_VOICE_MAP[config.gender]?.[config.age]?.[config.timbre] ?? 'default'
  }
}

class VolcanoTTSProvider implements TTSProvider {
  name = 'volcano'
  private client: VolcanoClient

  async synthesize(text: string, voiceId: string): Promise<string> {
    return await this.client.synthesize({ text, appid: voiceId })
  }

  getVoiceId(config: VoiceConfig): string {
    return VOLCANO_VOICE_MAP[config.gender]?.[config.age]?.[config.tone] ?? 'default'
  }
}

// 3. Service uses abstraction
class VoiceService {
  constructor(private providers: Map<string, TTSProvider>) {}

  async synthesize(text: string, platform: string, voiceConfig: VoiceConfig): Promise<string> {
    const provider = this.providers.get(platform)
    if (!provider) {
      throw new Error(`Unknown TTS platform: ${platform}`)
    }

    const voiceId = provider.getVoiceId(voiceConfig)
    return await provider.synthesize(text, voiceId)
  }
}

// 4. Register providers at startup
const providers = new Map<string, TTSProvider>()
providers.set('aliyun', new AliyunTTSProvider())
providers.set('volcano', new VolcanoTTSProvider())

const voiceService = new VoiceService(providers)

// Adding new provider? Just implement interface and register!
// providers.set('azure', new AzureTTSProvider())
```

**Benefits**:

- ✅ OCP: Add providers without modifying existing code
- ✅ SRP: Each provider handles its own logic
- ✅ Testable: Mock providers independently
- ✅ DRY: Common orchestration in one place

---

## Example 2: Episode Generation (Facade + Template Method)

### Before: Scattered Logic

```typescript
// ❌ Bad: Complex workflow in route handler
fastify.post('/api/episodes/:id/generate-script', async (request, reply) => {
  const episodeId = request.params.id
  const userId = getRequestUserId(request)

  // Fetch episode
  const episode = await prisma.episode.findUnique({ where: { id: episodeId } })
  if (!episode) {
    return reply.code(404).send({ error: 'Episode not found' })
  }

  // Fetch project context
  const project = await prisma.project.findUnique({
    where: { id: episode.projectId },
    include: { outline: true }
  })

  // Fetch memory context
  const memories = await prisma.storyMemory.findMany({
    where: { projectId: episode.projectId },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  // Build prompt
  let prompt = `Generate script for episode ${episode.number}\n`
  prompt += `Project: ${project.name}\n`
  prompt += `Style: ${project.visualStyle}\n\n`

  if (project.outline) {
    prompt += `Outline: ${project.outline.content}\n\n`
  }

  prompt += `Previous memories:\n`
  memories.forEach((m) => {
    prompt += `- ${m.content}\n`
  })

  // Call LLM
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  const scriptContent = data.choices[0].message.content

  // Save to database
  const script = await prisma.script.create({
    data: {
      episodeId,
      content: scriptContent,
      generatedBy: 'deepseek'
    }
  })

  // Log API call
  await prisma.modelApiCall.create({
    data: {
      userId,
      model: 'deepseek-chat',
      provider: 'deepseek',
      op: 'generate-script',
      status: 'success',
      cost: data.usage?.total_tokens ? calculateCost(data.usage.total_tokens) : 0
    }
  })

  return { success: true, data: script }
})
```

**Problems**:

- Route handler does everything (violates layering)
- No reusability
- Hard to test
- No error handling
- Violates SRP

### After: Facade + Template Method

```typescript
// ✅ Good: Clean separation

// 1. Context builder (separate concern)
class ScriptGenerationContextBuilder {
  constructor(
    private episodeRepo: EpisodeRepository,
    private projectRepo: ProjectRepository,
    private memoryService: MemoryService
  ) {}

  async buildContext(episodeId: string): Promise<ScriptGenerationContext> {
    const episode = await this.episodeRepo.findById(episodeId)
    if (!episode) {
      throw new NotFoundError('Episode not found')
    }

    const project = await this.projectRepo.findById(episode.projectId)
    const memories = await this.memoryService.getRecentMemories(project.id, 10)

    return { episode, project, memories }
  }
}

// 2. Prompt builder (separate concern)
class ScriptPromptBuilder {
  build(context: ScriptGenerationContext): string {
    const parts = [
      `Generate script for episode ${context.episode.number}`,
      `Project: ${context.project.name}`,
      `Style: ${context.project.visualStyle}`
    ]

    if (context.project.outline) {
      parts.push(`Outline: ${context.project.outline.content}`)
    }

    if (context.memories.length > 0) {
      parts.push('Previous memories:')
      context.memories.forEach((m) => parts.push(`- ${m.content}`))
    }

    return parts.join('\n')
  }
}

// 3. Facade for complex workflow
class ScriptGenerationFacade {
  constructor(
    private contextBuilder: ScriptGenerationContextBuilder,
    private promptBuilder: ScriptPromptBuilder,
    private llmService: LLMService,
    private scriptRepo: ScriptRepository,
    private apiLogger: ApiCallLogger
  ) {}

  async generateScript(episodeId: string, userId: string): Promise<Script> {
    // Build context
    const context = await this.contextBuilder.buildContext(episodeId)

    // Generate prompt
    const prompt = this.promptBuilder.build(context)

    // Call LLM with logging
    const { content, usage } = await this.llmService.generateWithLogging({
      prompt,
      model: 'deepseek-chat',
      context: {
        userId,
        op: 'generate-script',
        projectId: context.project.id
      }
    })

    // Save script
    const script = await this.scriptRepo.create({
      episodeId,
      content,
      generatedBy: 'deepseek'
    })

    return script
  }
}

// 4. Thin route handler
fastify.post(
  '/api/episodes/:id/generate-script',
  {
    preHandler: [fastify.authenticate]
  },
  async (request, reply) => {
    const episodeId = request.params.id
    const userId = getRequestUserId(request)

    try {
      const script = await fastify.scriptGenerationFacade.generateScript(episodeId, userId)

      return reply.code(201).send({ success: true, data: script })
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message })
      }
      throw error // Let Fastify error handler deal with it
    }
  }
)
```

**Benefits**:

- ✅ Each class has one responsibility
- ✅ Facade simplifies complex workflow
- ✅ Easy to test each component
- ✅ Route handler is thin
- ✅ Error handling is clear

---

## Example 3: Job Type Labels (DRY + Single Source)

### Before: Duplicated Across Files

```typescript
// ❌ Bad: Labels duplicated in multiple places

// File 1: Jobs.vue
function getJobTypeLabel(type: string) {
  if (type === 'video') return '视频生成'
  if (type === 'import') return '剧本导入'
  if (type === 'pipeline') return '流水线任务'
  if (type === 'image') return '图片生成'
  if (type === 'episode-storyboard-script') return 'AI生成分镜脚本'
  return type
}

// File 2: job-utils.ts
function translateJobType(type: string) {
  switch (type) {
    case 'video':
      return '视频生成'
    case 'import':
      return '剧本导入'
    case 'pipeline':
      return '流水线任务'
    case 'image':
      return '图片生成'
    default:
      return type
  }
}

// File 3: api-response.ts
const JOB_TYPE_NAMES = {
  video: '视频生成',
  import: '剧本导入',
  pipeline: '流水线任务',
  image: '图片生成'
}
```

**Problems**:

- DRY violation: Same mapping in 3 places
- Inconsistent: Missing `episode-storyboard-script` in file 3
- Maintenance nightmare: Must update all files when adding new type

### After: Single Source of Truth

```typescript
// ✅ Good: Centralized in shared package

// packages/shared/src/job-types.ts
export const JOB_TYPE_LABELS = {
  video: '视频生成',
  import: '剧本导入',
  pipeline: '流水线任务',
  image: '图片生成',
  'episode-storyboard-script': 'AI生成分镜脚本'
} as const

export type JobType = keyof typeof JOB_TYPE_LABELS

export function getJobTypeLabel(type: string): string {
  return JOB_TYPE_LABELS[type as JobType] ?? type
}

// Now import where needed:
// import { getJobTypeLabel, JOB_TYPE_LABELS } from '@dreamer/shared'
```

**Benefits**:

- ✅ DRY: Single source of truth
- ✅ Type-safe: TypeScript catches typos
- ✅ Easy to maintain: One place to update
- ✅ Shared: Both frontend and backend use same labels

---

## Example 4: Prisma Repository Pattern (DIP + Repository)

### Before: Direct Prisma Calls in Services

```typescript
// ❌ Bad: Service tightly coupled to Prisma
class CharacterService {
  private prisma = new PrismaClient()

  async getCharacterWithImages(id: string) {
    return await this.prisma.character.findUnique({
      where: { id },
      include: {
        images: true,
        project: true
      }
    })
  }

  async createCharacter(data: any) {
    return await this.prisma.character.create({ data })
  }

  async updateCharacter(id: string, data: any) {
    return await this.prisma.character.update({
      where: { id },
      data
    })
  }
}
```

**Problems**:

- Hard to test (can't mock Prisma easily)
- Can't swap data source
- Prisma queries scattered across services
- No centralized error handling

### After: Repository Pattern

```typescript
// ✅ Good: Abstracted data access

// 1. Repository interface
interface CharacterRepository {
  findById(id: string): Promise<Character | null>
  findByIdWithImages(id: string): Promise<CharacterWithImages | null>
  findByProjectId(projectId: string): Promise<Character[]>
  create(data: CreateCharacterInput): Promise<Character>
  update(id: string, data: UpdateCharacterInput): Promise<Character>
  delete(id: string): Promise<void>
}

// 2. Prisma implementation
class PrismaCharacterRepository implements CharacterRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Character | null> {
    return await this.prisma.character.findUnique({
      where: { id }
    })
  }

  async findByIdWithImages(id: string): Promise<CharacterWithImages | null> {
    return await this.prisma.character.findUnique({
      where: { id },
      include: {
        images: { orderBy: { createdAt: 'asc' } },
        project: true
      }
    })
  }

  async findByProjectId(projectId: string): Promise<Character[]> {
    return await this.prisma.character.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' }
    })
  }

  async create(data: CreateCharacterInput): Promise<Character> {
    return await this.prisma.character.create({ data })
  }

  async update(id: string, data: UpdateCharacterInput): Promise<Character> {
    return await this.prisma.character.update({
      where: { id },
      data
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.character.delete({ where: { id } })
  }
}

// 3. Service depends on abstraction
class CharacterService {
  constructor(private repository: CharacterRepository) {}

  async getCharacterWithImages(id: string): Promise<CharacterWithImages> {
    const character = await this.repository.findByIdWithImages(id)
    if (!character) {
      throw new NotFoundError('Character not found')
    }
    return character
  }

  async createCharacter(data: CreateCharacterInput): Promise<Character> {
    // Can add business logic here
    await this.validateCharacterData(data)
    return await this.repository.create(data)
  }
}

// 4. Wire up at startup
const repository = new PrismaCharacterRepository(prisma)
const service = new CharacterService(repository)

// 5. Easy to test
const mockRepository: CharacterRepository = {
  findById: vi.fn(),
  findByIdWithImages: vi.fn()
  // ... other methods
}
const service = new CharacterService(mockRepository)
```

**Benefits**:

- ✅ DIP: Service depends on interface, not Prisma
- ✅ Testable: Mock repository in tests
- ✅ Centralized: All Prisma queries in one place
- ✅ Flexible: Can swap data source (e.g., add caching)

---

## Example 5: Vue Composable for Polling (Separation of Concerns)

### Before: Polling Logic in Component

```typescript
<!-- ❌ Bad: Polling mixed with UI logic -->
<script setup lang="ts">
const episode = ref<Episode | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let pollingTimer: NodeJS.Timeout | null = null

async function fetchEpisode() {
  loading.value = true
  try {
    episode.value = await api.getEpisode(episodeId)
    error.value = null

    // Keep polling if still generating
    if (episode.value.status === 'generating') {
      pollingTimer = setTimeout(fetchEpisode, 3000)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to fetch'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchEpisode()
})

onUnmounted(() => {
  if (pollingTimer) {
    clearTimeout(pollingTimer)
  }
})
</script>
```

**Problems**:

- Polling logic mixed with component
- Can't reuse in other components
- Component is cluttered

### After: Extracted Composable

```typescript
// ✅ Good: Reusable composable

// composables/usePolling.ts
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  options: PollingOptions = {}
) {
  const {
    intervalMs = 3000,
    shouldContinue = () => true,
    maxRetries = 100
  } = options

  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const retryCount = ref(0)

  let timer: NodeJS.Timeout | null = null

  async function fetch() {
    if (retryCount.value >= maxRetries) {
      error.value = 'Max polling retries reached'
      stop()
      return
    }

    loading.value = true
    try {
      data.value = await fetchFn()
      error.value = null
      retryCount.value = 0

      // Continue polling if condition met
      if (shouldContinue(data.value)) {
        timer = setTimeout(fetch, intervalMs)
      } else {
        stop()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch'
      retryCount.value++
      timer = setTimeout(fetch, intervalMs) // Retry on error
    } finally {
      loading.value = false
    }
  }

  function start() {
    fetch()
  }

  function stop() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  onUnmounted(() => {
    stop()
  })

  return { data, loading, error, start, stop }
}

// Usage in component - clean and simple!
<script setup lang="ts">
const { data: episode, loading, error, start } = usePolling(
  () => api.getEpisode(episodeId),
  {
    intervalMs: 3000,
    shouldContinue: (ep) => ep?.status === 'generating',
    maxRetries: 100
  }
)

onMounted(() => {
  start()
})
</script>
```

**Benefits**:

- ✅ Reusable: Use in any component
- ✅ Configurable: Interval, conditions, max retries
- ✅ Clean component: Only business logic remains
- ✅ Testable: Composable can be tested independently

---

## Summary: Pattern Usage in Dreamer

| Pattern         | Where Used                        | Benefit                         |
| --------------- | --------------------------------- | ------------------------------- |
| Strategy        | TTS providers, AI providers       | Easy to add new providers       |
| Repository      | Data access layer                 | Testable, swappable data source |
| Facade          | Script generation, video pipeline | Simplifies complex workflows    |
| Factory         | Job creation, provider selection  | Centralized object creation     |
| Observer        | Event system, notifications       | Decoupled event handling        |
| Adapter         | DeepSeek OpenAI compatibility     | Integrate external APIs         |
| Template Method | Pipeline job processing           | Consistent job lifecycle        |
| Composition     | Vue composables                   | Reusable state logic            |

---

## When to Apply Each Pattern

**Use Strategy when**:

- Multiple algorithms for same task (TTS, image generation)
- Need to switch behavior at runtime

**Use Repository when**:

- Data access logic is complex
- Need to mock database in tests
- Might change data source

**Use Facade when**:

- Workflow has many steps
- Need simple interface for complex subsystem

**Use Factory when**:

- Object creation is complex
- Need to create different types based on input

**Use Observer when**:

- Multiple components need to react to events
- Want loose coupling between publisher and subscribers

**Use Adapter when**:

- Integrating external API with different interface
- Need to make incompatible interfaces work together
