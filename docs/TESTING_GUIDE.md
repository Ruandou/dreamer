# Backend Testing Guide

## Overview

This guide covers the testing patterns used in the Dreamer backend test suite. Our goal is **90%+ test coverage** with maintainable, fast-running tests.

## Current Status

- **Tests**: 900+ passing tests
- **Coverage**: ~80.78%
- **Framework**: Vitest
- **Location**: `packages/backend/tests/`

## Running Tests

```bash
# Run all tests
cd packages/backend && pnpm test

# Run with coverage
cd packages/backend && pnpm test --run --coverage

# Run specific test file
cd packages/backend && pnpm vitest run tests/specific-test.test.ts

# Run in watch mode
cd packages/backend && pnpm test:watch
```

## Testing Patterns

### Pattern 1: Pure Functions (Easiest & Highest ROI)

Test exported pure functions directly - no mocking needed.

**Example:**
```typescript
import { getPipelineSteps, estimatePipelineCost } from '../src/services/pipeline-orchestrator.js'

describe('getPipelineSteps', () => {
  it('returns all steps in order', () => {
    const steps = getPipelineSteps()
    expect(steps).toHaveLength(7)
    expect(steps[0]).toBe('script-writing')
  })
})
```

**When to use:** Functions that don't depend on external state (database, network, files).

---

### Pattern 2: Private Methods via Type Casting

Access private methods for testing without breaking encapsulation.

**Example:**
```typescript
import { EpisodeService } from '../src/services/episode-service.js'

describe('EpisodeService', () => {
  let service: EpisodeService
  let mockRepo: any

  beforeEach(() => {
    mockRepo = {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
    service = new EpisodeService(mockRepo)
  })

  it('applies script content correctly', async () => {
    mockRepo.findUnique.mockResolvedValue({ id: 'ep-1' })
    
    // Access private method via type casting
    const result = await (service as any).applyScriptContentToEpisode(
      'ep-1',
      'proj-1',
      'Title',
      script
    )
    
    expect(result.scenesCreated).toBe(3)
  })
})
```

**When to use:** Complex business logic in private methods that needs comprehensive testing.

---

### Pattern 3: Repository Mocking

Mock repository methods to isolate service logic.

**Example:**
```typescript
import { CharacterService } from '../src/services/character-service.js'

describe('CharacterService', () => {
  const mockRepo = {
    findFirstByProjectAndName: vi.fn(),
    createCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    deleteCharacter: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates character with correct data', async () => {
    mockRepo.createCharacter.mockResolvedValue({ id: 'char-1', name: 'Alice' })

    const service = new CharacterService(mockRepo as any)
    const result = await service.createCharacter('proj-1', { name: 'Alice' })

    expect(mockRepo.createCharacter).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alice'
      })
    )
    expect(result.id).toBe('char-1')
  })
})
```

**When to use:** Testing service methods that interact with repositories.

---

### Pattern 4: Module Mocking with vi.mock

Mock entire modules before importing.

**Example:**
```typescript
// Mock must be at the top, before imports
vi.mock('../src/services/ai/api-logger.js', () => ({
  recordModelApiCall: vi.fn(),
  getApiCalls: vi.fn()
}))

import { someService } from '../src/services/some-service.js'

describe('SomeService', () => {
  it('calls API logger', async () => {
    const { recordModelApiCall } = await import('../src/services/ai/api-logger.js')
    
    await someService.doSomething()
    
    expect(recordModelApiCall).toHaveBeenCalled()
  })
})
```

**When to use:** Preventing database calls, API calls, or expensive operations during tests.

---

### Pattern 5: Console Suppression (for Clean Test Output)

Suppress noisy console output while preserving test assertions.

**Example:**
```typescript
describe('NoisyService', () => {
  const originalError = console.error
  const originalWarn = console.warn

  beforeEach(() => {
    console.error = vi.fn()
    console.warn = vi.fn()
  })

  afterEach(() => {
    console.error = originalError
    console.warn = originalWarn
  })

  it('handles errors gracefully', () => {
    // Test that would normally log errors
    expect(() => someOperation()).not.toThrow()
  })
})
```

**When to use:** Tests that intentionally trigger error/warning logs.

---

## Best Practices

### ✅ DO

1. **Test pure functions first** - Highest ROI, no mocking needed
2. **Use descriptive test names** - `it('calculates cost for multi-scene script', ...)`
3. **Mock at the boundary** - Mock repositories, not internal implementations
4. **Test edge cases** - Empty arrays, null values, boundary conditions
5. **Keep tests fast** - Avoid real database/network calls
6. **Use `vi.clearAllMocks()` in `beforeEach`** - Prevent test pollution

### ❌ DON'T

1. **Don't test implementation details** - Test behavior, not internal state
2. **Don't skip error cases** - Test both success and failure paths
3. **Don't use `--no-verify`** - All commits must pass tests
4. **Don't mock everything** - Only mock external dependencies
5. **Don't ignore TypeScript errors** - Fix them properly with type assertions

---

## Test File Organization

```
packages/backend/tests/
├── episodes.test.ts                    # Route handler tests
├── episode-service-apply-script.test.ts # Service method tests
├── pipeline-orchestrator-pure-functions.test.ts  # Pure function tests
├── scene-asset-pure-functions.test.ts   # Pure function tests
└── ...
```

**Naming convention:** `<module-name>.test.ts` or `<module-name>-<feature>.test.ts`

---

## Coverage Goals

| Module Type | Target Coverage |
|-------------|----------------|
| Pure utilities | 95%+ |
| Service methods | 85%+ |
| Route handlers | 80%+ |
| Complex integrations | 70%+ |

---

## Common Pitfalls

### 1. Floating Point Comparisons

```typescript
// ❌ Wrong
expect(result).toBe(0.3)

// ✅ Correct
expect(result).toBeCloseTo(0.3, 1)
```

### 2. Missing Type Assertions

```typescript
// ❌ TypeScript error
const service = new EpisodeService(mockRepo)

// ✅ Correct
const service = new EpisodeService(mockRepo as any)
```

### 3. Forgetting to Clear Mocks

```typescript
// ✅ Always clear mocks
beforeEach(() => {
  vi.clearAllMocks()
})
```

### 4. Testing Private Methods Wrong

```typescript
// ❌ Can't subclass to expose private methods
class TestableService extends EpisodeService {
  public privateMethod() { ... } // TypeScript error!
}

// ✅ Use type casting
const result = await (service as any).privateMethod()
```

---

## Quick Start: Adding a New Test

1. **Identify what to test** - Pure function? Service method? Route?
2. **Create test file** - `packages/backend/tests/<module>.test.ts`
3. **Choose pattern** - Use one of the 5 patterns above
4. **Write tests** - Cover normal case + edge cases + errors
5. **Run tests** - `pnpm vitest run tests/<module>.test.ts`
6. **Check coverage** - `pnpm vitest run --coverage | grep <module>`
7. **Commit** - Tests must pass before committing

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://vitest.dev/guide/)
- [Project AGENTS.md](../../AGENTS.md) - Development rules

---

*Last updated: 2026-04-17 | Tests: 900+ | Coverage: 80.78%*
