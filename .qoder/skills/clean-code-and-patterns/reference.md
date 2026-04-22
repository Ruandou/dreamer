# Anti-Patterns & Refactoring Guide

Common code smells in the Dreamer project and how to fix them using SOLID principles and design patterns.

---

## 1. God Object / Blob Class

**Smell**: One class/service does everything.

```typescript
// ❌ Bad: EpisodeService handles too many concerns
class EpisodeService {
  async createEpisode(data: any) { ... }
  async generateScript(episodeId: string) { ... }
  async sendNotification(userId: string) { ... }
  async logAnalytics(event: string) { ... }
  async cacheEpisode(episodeId: string) { ... }
  async exportToPDF(episodeId: string) { ... }
}
```

**Fix**: Apply SRP - Split by responsibility.

```typescript
// ✅ Good: Focused services
class EpisodeService {
  constructor(
    private repository: EpisodeRepository,
    private validator: EpisodeValidator
  ) {}

  async createEpisode(data: CreateEpisodeInput) { ... }
  async getEpisode(id: string) { ... }
}

class ScriptGenerationService {
  constructor(
    private llmService: LLMService,
    private memoryService: MemoryService
  ) {}

  async generateScript(episodeId: string) { ... }
}

class NotificationService {
  async sendEpisodeCreatedNotification(userId: string, episodeId: string) { ... }
}
```

---

## 2. Tight Coupling to External APIs

**Smell**: Business logic directly calls HTTP clients.

```typescript
// ❌ Bad: Tightly coupled to Seedream
class CharacterImageService {
  async generateImage(character: Character) {
    const prompt = this.buildPrompt(character)

    // Direct API call - hard to test, hard to switch providers
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ARK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'doubao-seedream-5-0-lite',
        prompt
      })
    })

    const data = await response.json()
    return data.data[0].url
  }
}
```

**Fix**: Use Strategy pattern with interface abstraction.

```typescript
// ✅ Good: Abstracted via interface
interface ImageGenerator {
  generate(prompt: string, options?: ImageOptions): Promise<string>
}

class SeedreamGenerator implements ImageGenerator {
  constructor(private client: ArkClient) {}

  async generate(prompt: string): Promise<string> {
    const response = await this.client.images.generate({
      model: 'doubao-seedream-5-0-lite',
      prompt
    })
    return response.data[0].url
  }
}

class CharacterImageService {
  constructor(private generator: ImageGenerator) {}

  async generateImage(character: Character) {
    const prompt = this.buildPrompt(character)
    return await this.generator.generate(prompt)
  }
}

// Easy to swap providers
const service = new CharacterImageService(new SeedreamGenerator(client))
// or
const service = new CharacterImageService(new MidjourneyGenerator(client))
```

---

## 3. Switch Statement Smell (Violates OCP)

**Smell**: Adding new types requires modifying existing code.

```typescript
// ❌ Bad: Must modify this method to add new job type
class JobProcessor {
  async process(job: Job) {
    switch (job.type) {
      case 'video':
        await this.processVideoJob(job)
        break
      case 'image':
        await this.processImageJob(job)
        break
      case 'import':
        await this.processImportJob(job)
        break
      case 'pipeline':
        await this.processPipelineJob(job)
        break
      // Must add new case here for each new job type
    }
  }
}
```

**Fix**: Use Strategy pattern with registry.

```typescript
// ✅ Good: Open for extension
interface JobHandler {
  type: string
  handle(job: Job): Promise<void>
}

class VideoJobHandler implements JobHandler {
  type = 'video'
  async handle(job: Job) { ... }
}

class ImageJobHandler implements JobHandler {
  type = 'image'
  async handle(job: Job) { ... }
}

class JobProcessor {
  private handlers = new Map<string, JobHandler>()

  register(handler: JobHandler) {
    this.handlers.set(handler.type, handler)
  }

  async process(job: Job) {
    const handler = this.handlers.get(job.type)
    if (!handler) {
      throw new Error(`Unknown job type: ${job.type}`)
    }
    await handler.handle(job)
  }
}

// Register handlers (can be done at startup)
const processor = new JobProcessor()
processor.register(new VideoJobHandler())
processor.register(new ImageJobHandler())
processor.register(new ImportJobHandler())
// New handler? Just register it - no need to modify JobProcessor
```

---

## 4. Anemic Domain Model

**Smell**: Entities are just data bags with no behavior.

```typescript
// ❌ Bad: Entity with no behavior
interface Episode {
  id: string
  title: string
  status: 'draft' | 'published' | 'archived'
  publishedAt: Date | null
}

// Logic scattered in services
function publishEpisode(episode: Episode) {
  if (episode.status !== 'draft') {
    throw new Error('Can only publish draft episodes')
  }
  episode.status = 'published'
  episode.publishedAt = new Date()
}
```

**Fix**: Add behavior to domain entities.

```typescript
// ✅ Good: Rich domain model
class Episode {
  constructor(
    public id: string,
    public title: string,
    public status: EpisodeStatus,
    public publishedAt: Date | null = null
  ) {}

  canPublish(): boolean {
    return this.status === 'draft'
  }

  publish(): void {
    if (!this.canPublish()) {
      throw new Error('Can only publish draft episodes')
    }
    this.status = 'published'
    this.publishedAt = new Date()
  }

  archive(): void {
    if (this.status === 'draft') {
      throw new Error('Cannot archive unpublished episode')
    }
    this.status = 'archived'
  }
}

// Service becomes simpler
class EpisodeService {
  async publishEpisode(episodeId: string) {
    const episode = await this.repository.findById(episodeId)
    episode.publish() // Business logic in entity
    await this.repository.save(episode)
  }
}
```

---

## 5. Primitive Obsession

**Smell**: Using primitives for domain concepts.

```typescript
// ❌ Bad: Primitives everywhere
function createEpisode(
  title: string,
  description: string,
  duration: number, // What unit? seconds? minutes?
  status: string // What are valid values?
) {
  if (duration < 0) throw new Error('Invalid duration')
  if (!['draft', 'published', 'archived'].includes(status)) {
    throw new Error('Invalid status')
  }
  // ...
}
```

**Fix**: Use value objects and enums.

```typescript
// ✅ Good: Domain types
enum EpisodeStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived'
}

class EpisodeDuration {
  constructor(public readonly seconds: number) {
    if (seconds < 0) {
      throw new Error('Duration cannot be negative')
    }
  }

  toMinutes(): number {
    return this.seconds / 60
  }

  toString(): string {
    const mins = Math.floor(this.seconds / 60)
    const secs = this.seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
}

function createEpisode(
  title: string,
  description: string,
  duration: EpisodeDuration,
  status: EpisodeStatus
) {
  // No validation needed - types guarantee correctness
}
```

---

## 6. Feature Envy

**Smell**: Method uses another class more than its own.

```typescript
// ❌ Bad: LocationService knows too much about Character
class LocationService {
  generateSceneDescription(location: Location, characters: Character[]) {
    let description = location.description

    // This logic belongs to Character!
    characters.forEach((char) => {
      if (char.outfit) {
        description += ` ${char.name} wears ${char.outfit.description}`
      }
      if (char.emotion) {
        description += ` looking ${char.emotion}`
      }
    })

    return description
  }
}
```

**Fix**: Move behavior to the class it envies.

```typescript
// ✅ Good: Character knows about its own appearance
class Character {
  getAppearanceDescription(): string {
    const parts = [this.name]

    if (this.outfit) {
      parts.push(`wearing ${this.outfit.description}`)
    }
    if (this.emotion) {
      parts.push(`looking ${this.emotion}`)
    }

    return parts.join(' ')
  }
}

class LocationService {
  generateSceneDescription(location: Location, characters: Character[]) {
    const characterDescs = characters.map((c) => c.getAppearanceDescription())
    return `${location.description} ${characterDescs.join(', ')}`
  }
}
```

---

## 7. Shotgun Surgery

**Smell**: One change requires modifying many files.

```typescript
// ❌ Bad: Adding new AI provider requires changes everywhere
// services/deepseek.ts - add case
// services/seedance.ts - add case
// routes/ai-routes.ts - add validation
// handlers/ai-handler.ts - add mapping
// tests/ai.test.ts - add test case
```

**Fix**: Use polymorphism and centralized configuration.

```typescript
// ✅ Good: Add provider in one place
// 1. Implement interface
class NewAIProvider implements AIProvider {
  async generate(prompt: string): Promise<string> { ... }
}

// 2. Register in provider map
const providers = {
  deepseek: new DeepSeekProvider(),
  seedance: new SeedanceProvider(),
  newai: new NewAIProvider() // Just add here!
}

// 3. Environment variable
// .env: AI_PROVIDER=newai

// That's it! No other files need changes.
```

---

## 8. Data Clumps

**Smell**: Same group of data appears together repeatedly.

```typescript
// ❌ Bad: Repeated data structure
function generateVideo(prompt: string, width: number, height: number, fps: number) { ... }
function resizeVideo(url: string, width: number, height: number, fps: number) { ... }
function validateVideoParams(width: number, height: number, fps: number) { ... }
```

**Fix**: Extract into value object.

```typescript
// ✅ Good: Cohesive data structure
class VideoConfig {
  constructor(
    public readonly width: number,
    public readonly height: number,
    public readonly fps: number
  ) {
    this.validate()
  }

  private validate() {
    if (this.width <= 0 || this.height <= 0) {
      throw new Error('Invalid dimensions')
    }
    if (this.fps <= 0 || this.fps > 60) {
      throw new Error('Invalid FPS')
    }
  }

  get resolution(): string {
    return `${this.width}x${this.height}`
  }
}

function generateVideo(prompt: string, config: VideoConfig) { ... }
function resizeVideo(url: string, config: VideoConfig) { ... }
// Validation happens automatically in constructor
```

---

## Quick Reference: Code Smell → Solution

| Code Smell             | Principle Violated | Solution Pattern                  |
| ---------------------- | ------------------ | --------------------------------- |
| God Object             | SRP                | Extract classes by responsibility |
| Tight Coupling         | DIP                | Dependency injection, interfaces  |
| Switch Statements      | OCP                | Strategy pattern, polymorphism    |
| Anemic Model           | Encapsulation      | Rich domain entities              |
| Primitive Obsession    | Type Safety        | Value objects, enums              |
| Feature Envy           | SRP                | Move method to data's class       |
| Shotgun Surgery        | OCP                | Centralized configuration         |
| Data Clumps            | Cohesion           | Value objects                     |
| Duplicated Code        | DRY                | Extract function/class            |
| Long Method            | SRP                | Extract method                    |
| Large Class            | SRP                | Extract class                     |
| Speculative Generality | YAGNI              | Remove unused abstractions        |

---

## Refactoring Workflow

When you identify a code smell:

1. **Identify the smell** - Use this guide to name it
2. **Write tests** - Ensure behavior is captured before refactoring
3. **Apply pattern** - Use the appropriate refactoring technique
4. **Run tests** - Verify behavior hasn't changed
5. **Commit** - Small, focused commits with clear messages

```bash
# Example commit messages
refactor: extract NotificationService from EpisodeService (SRP)
refactor: replace switch with Strategy pattern in JobProcessor (OCP)
refactor: introduce VideoConfig value object (Data Clumps)
```
