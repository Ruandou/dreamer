# AI Writing Agent Architecture Design

## Overview

This document designs a multi-agent architecture for the Dreamer AI short-drama platform's writing module. The design builds on existing infrastructure (Memory System, Pipeline Orchestrator, Script Writer) and introduces specialized agents with clear responsibilities, structured communication, and state management.

---

## Current Architecture Analysis

### Existing Strengths

1. **Memory System** (`services/memory/`) - Structured剧情记忆 with extraction, context building, and persistence
2. **Pipeline Orchestrator** (`services/pipeline-orchestrator.ts`) - Step-based execution with strategy pattern
3. **Script Writer** (`services/script-writer.ts`) - Multi-function LLM wrapper with retry logic
4. **Prompt Registry** (`services/prompts/`) - Centralized template management
5. **Model API Call Logging** - Built-in observability and cost tracking

### Current Limitations

1. **Monolithic agents** - `writeScriptFromIdea`, `writeEpisodeForProject` handle too many responsibilities
2. **No reflection loop** - Generated content isn't automatically critiqued/revised
3. **Limited state management** - No checkpointing for long-running generation
4. **No parallel execution** - Episodes generated serially, missing optimization opportunities
5. **Weak inter-agent communication** - Agents don't share structured state beyond function returns

---

## Proposed Agent Architecture

### Architecture Pattern: Hybrid Supervisor-Worker + Reflection

```
                    ┌─────────────────────┐
                    │   Writing Orchestrator  │
                    │   (Supervisor Agent)    │
                    └──────────┬──────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │ Outline     │   │ Draft       │   │ Critic      │
     │ Agent       │   │ Agent       │   │ Agent       │
     └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
            │                  │                  │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │ Research    │   │ Style       │   │ Revision    │
     │ Agent       │   │ Agent       │   │ Agent       │
     └─────────────┘   └─────────────┘   └─────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Shared State      │
                    │   (PostgreSQL +     │
                    │    Memory System)   │
                    └─────────────────────┘
```

---

## Agent Definitions

### 1. Writing Orchestrator (Supervisor)

**Responsibility:** Coordinate writing workflow, manage state transitions, route tasks to specialists

**Inputs:**

- User request (idea, outline, or episode request)
- Project context (characters, locations, style guide)
- Memory system (previous episodes, plot points)

**Outputs:**

- Writing plan (which agents to invoke, in what order)
- Final validated content
- State checkpoint for resumption

**State Machine:**

```typescript
type OrchestratorState =
  | { phase: 'planning'; plan: WritingPlan }
  | { phase: 'executing'; currentAgent: string; progress: number }
  | { phase: 'reviewing'; draft: ScriptContent; critique: CritiqueResult }
  | { phase: 'revising'; revisionCount: number }
  | { phase: 'completed'; result: ScriptContent }
  | { phase: 'failed'; error: string }
```

**Key Methods:**

```typescript
interface WritingOrchestrator {
  // Entry point
  executeWritingTask(request: WritingRequest): Promise<WritingResult>

  // State management
  saveCheckpoint(state: AgentState): Promise<void>
  restoreCheckpoint(jobId: string): Promise<AgentState>

  // Agent coordination
  delegateToAgent(agentType: AgentType, input: AgentInput): Promise<AgentOutput>
  evaluateAndRoute(output: AgentOutput): Promise<NextAction>
}
```

---

### 2. Outline Agent

**Responsibility:** Generate structural blueprint for episodes/scenes

**Specialization:**

- Episode-level outlines (100-200 words per episode)
- Scene-level breakdowns (location, characters, conflict)
- Plot arc tracking (setup, confrontation, resolution)

**Inputs:**

- Series synopsis
- Target episode number
- Previous episode summaries (from Memory System)
- User hints (optional)

**Outputs:**

```typescript
interface OutlineOutput {
  episodeNum: number
  title: string
  synopsis: string
  scenes: {
    sceneNum: number
    location: string
    characters: string[]
    conflict: string
    duration: number
  }[]
  plotProgress: {
    setups: string[]
    reveals: string[]
    cliffhangers: string[]
  }
}
```

**Implementation:**

- Extends existing `generateEpisodeOutline()` in `script-writer.ts`
- Adds scene-level granularity
- Integrates with Memory System for continuity

---

### 3. Draft Agent

**Responsibility:** Generate full prose from outline + context

**Specialization:**

- Dialogue writing (character voice consistency)
- Action descriptions (visual, specific)
- Pacing control (tension building, release)

**Inputs:**

- Outline from Outline Agent
- Character profiles + voice configs
- Location descriptions
- Memory context (recent events, relationships)
- Style guide (tone, genre conventions)

**Outputs:**

```typescript
interface DraftOutput {
  script: ScriptContent
  characterVoices: Map<string, VoiceProfile>
  pacingNotes: {
    sceneNum: number
    tension: 'low' | 'medium' | 'high'
    notes: string
  }[]
}
```

**Implementation:**

- Extends `writeEpisodeForProject()` with structured context
- Uses `buildEpisodeWritingContext()` from Memory System
- Leverages TTS module's `VoiceConfig` for character consistency

---

### 4. Critic Agent

**Responsibility:** Evaluate draft quality against criteria

**Evaluation Dimensions:**

1. **Narrative Consistency** - Plot holes, timeline errors
2. **Character Voice** - Dialogue matches character profile
3. **Pacing** - Tension arc appropriate for episode position
4. **Visual Clarity** - Scenes describable for AI video generation
5. **Genre Conventions** - Meets audience expectations

**Inputs:**

- Draft script
- Original outline
- Character/location profiles
- Style guide

**Outputs:**

```typescript
interface CritiqueResult {
  overallScore: number // 0-100
  dimensions: {
    narrativeConsistency: { score: number; issues: string[] }
    characterVoice: { score: number; issues: string[] }
    pacing: { score: number; issues: string[] }
    visualClarity: { score: number; issues: string[] }
    genreConventions: { score: number; issues: string[] }
  }
  pass: boolean // >= threshold
  actionableFeedback: string[]
}
```

**Implementation:**

- New agent, uses LLM with structured evaluation prompt
- Threshold configurable (default: 75/100)
- Feedback must be actionable (not just "improve pacing")

---

### 5. Revision Agent

**Responsibility:** Rewrite draft based on critique feedback

**Specialization:**

- Targeted revisions (address specific issues)
- Preserve good content (don't over-edit)
- Maintain character voice consistency

**Inputs:**

- Original draft
- Critique results
- Revision priority (which issues to fix first)

**Outputs:**

```typescript
interface RevisionOutput {
  revisedScript: ScriptContent
  changesMade: {
    sceneNum: number
    changeType: 'dialogue' | 'action' | 'structure' | 'pacing'
    description: string
  }[]
  remainingIssues: string[] // If some issues need human review
}
```

**Implementation:**

- Extends `improveScript()` with structured feedback
- Revision limit (max 3 iterations to avoid infinite loops)
- Tracks what changed for transparency

---

### 6. Research Agent (Optional)

**Responsibility:** Gather factual/contextual information for realistic writing

**Use Cases:**

- Historical accuracy (period dramas)
- Technical details (sci-fi, medical, legal)
- Cultural authenticity

**Inputs:**

- Outline requiring research
- Research topics (from Outline Agent)

**Outputs:**

```typescript
interface ResearchOutput {
  topic: string
  facts: string[]
  references: string[]
  caveats: string[] // Things to be careful about
}
```

---

### 7. Style Agent (Optional)

**Responsibility:** Ensure tone/voice consistency across episodes

**Specialization:**

- Genre style matching (suspense, romance, comedy)
- Visual style consistency (cinematic, documentary, etc.)
- Language register (formal, casual, poetic)

**Inputs:**

- Draft script
- Project style guide
- Previous episodes (for consistency)

**Outputs:**

```typescript
interface StyleOutput {
  adjustedScript: ScriptContent
  styleDeviations: {
    sceneNum: number
    deviation: string
    severity: 'minor' | 'moderate' | 'major'
    correction: string
  }[]
}
```

---

## State Management Design

### Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│ Layer 1: Execution Checkpoints          │
│ - AgentState per job in PostgreSQL      │
│ - Resume after failure                  │
│ - Time-travel to earlier states         │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Layer 2: Memory System (Existing)       │
│ - MemoryItem (characters, events, etc.) │
│ - MemorySnapshot (episode boundaries)   │
│ - Semantic search for context retrieval │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Layer 3: In-Memory Coordination         │
│ - Current agent state (transient)       │
│ - Inter-agent message queue             │
│ - Active working context                │
└─────────────────────────────────────────┘
```

### Checkpoint Schema

```prisma
model AgentCheckpoint {
  id          String   @id @default(cuid())
  jobId       String   // PipelineJob or custom job
  agentType   String   // "outline", "draft", "critic", etc.
  phase       String   // "planning", "executing", "reviewing"
  state       Json     // Serialized agent state
  version     Int      @default(1)
  createdAt   DateTime @default(now())

  @@index([jobId])
  @@index([agentType])
}
```

### State Persistence Pattern

```typescript
interface CheckpointManager {
  // Save state at critical points
  save(jobId: string, agentType: string, state: AgentState): Promise<void>

  // Restore for resumption
  restore(jobId: string, agentType: string): Promise<AgentState | null>

  // List checkpoints for debugging
  list(jobId: string): Promise<CheckpointMeta[]>

  // Clean up old checkpoints
  cleanup(jobId: string, keepLast: number): Promise<void>
}
```

---

## Communication Patterns

### Pattern 1: Structured Message Passing (Primary)

Agents communicate via typed messages with metadata:

```typescript
interface AgentMessage<T = unknown> {
  type: MessageType
  sourceAgent: AgentType
  targetAgent: AgentType
  payload: T
  metadata: {
    jobId: string
    episodeId?: string
    timestamp: Date
    version: number
  }
}

type MessageType =
  | 'outline_complete'
  | 'draft_complete'
  | 'critique_ready'
  | 'revision_complete'
  | 'research_request'
  | 'style_adjustment'
  | 'error'
  | 'retry'
```

### Pattern 2: Shared Memory via Database

All agents read/write to common state:

```typescript
interface SharedWritingState {
  jobId: string
  episodeId: string

  // Accumulated outputs
  outline: OutlineOutput | null
  draft: ScriptContent | null
  critique: CritiqueResult | null
  revision: RevisionOutput | null

  // Context
  characters: Character[]
  locations: Location[]
  memories: MemoryItem[]

  // Control
  status: AgentStatus
  currentAgent: AgentType | null
  revisionCount: number
  maxRevisions: number

  // Timestamps
  startedAt: Date
  updatedAt: Date
  completedAt: Date | null
}
```

### Pattern 3: Event-Driven Pub-Sub (For Parallel Agents)

```typescript
interface EventBus {
  // Publish event
  emit(event: AgentEvent): void

  // Subscribe to event type
  on(eventType: string, handler: EventHandler): void

  // Subscribe to specific agent's events
  onAgentEvent(agentType: AgentType, handler: EventHandler): void
}

interface AgentEvent {
  type: string
  agentType: AgentType
  payload: unknown
  timestamp: Date
}
```

---

## Workflow Examples

### Workflow 1: Single Episode Generation

```
User Request: "Generate episode 3"
     ↓
[Orchestrator] Loads context from Memory System
     ↓
[Outline Agent] Generates episode 3 outline
     ↓ (saves to SharedState)
[Critic Agent] Evaluates outline quality
     ↓ (if score < threshold)
[Revision Agent] Revises outline
     ↓
[Draft Agent] Writes full script from outline
     ↓
[Critic Agent] Evaluates draft
     ↓ (if score >= threshold)
[Style Agent] Adjusts tone/voice
     ↓
[Orchestrator] Saves to Episode table, updates Memory System
     ↓
Return result to user
```

### Workflow 2: Parallel Multi-Episode Generation

```
User Request: "Generate all 10 episodes"
     ↓
[Orchestrator] Creates writing plan
     ↓
[Outline Agent] × 10 (parallel, independent)
     ↓ (wait for all)
[Critic Agent] × 10 (parallel)
     ↓ (consolidate)
[Orchestrator] Reviews all outlines, checks narrative arc
     ↓ (if global issues)
[Revision Agent] Revises problematic outlines
     ↓ (sequential, depends on previous)
[Draft Agent] Episode 1 → Episode 2 → ... → Episode 10
     ↓ (each episode updates Memory System)
Complete
```

### Workflow 3: Reflection Loop (Draft → Critique → Revise)

```
[Draft Agent] Generates v1
     ↓
[Critic Agent] Scores: 68/100 (below threshold)
     Issues: "Pacing too fast in scene 3", "Character B's voice inconsistent"
     ↓
[Orchestrator] Decides to retry (revisionCount < maxRevisions)
     ↓
[Revision Agent] Addresses specific issues → v2
     ↓
[Critic Agent] Scores: 82/100 (passes)
     ↓
[Orchestrator] Accepts, saves to database
```

---

## Agent Harness Design

### What is a Harness?

A **harness** is the runtime infrastructure that manages agent lifecycle, context windows, state persistence, and recovery. Unlike agent logic (what to do), the harness handles **how to sustain agents across long-running tasks** (context reset, compaction, state passing).

Based on Anthropic's engineering practices and recent research (arXiv 2603.25723), we implement a **file-backed harness** with compaction-stable state management.

---

### Harness Architecture

```
┌─────────────────────────────────────────────────┐
│              Writing Agent Harness               │
├─────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │ Initializer  │───▶│  Worker Loop         │   │
│  │ (Setup Once) │    │  (Per-Task Run)      │   │
│  └──────────────┘    └──────────┬───────────┘   │
│                                 │                │
│  ┌──────────────────────────────▼──────────────┐│
│  │          Context Management Layer           ││
│  │  - Context window monitoring                ││
│  │  - Compaction (history compression)         ││
│  │  - Context reset + state passing            ││
│  └─────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────┐│
│  │          State Persistence Layer            ││
│  │  - Task Registry (JSON, file-backed)        ││
│  │  - Session Log (step summaries)             ││
│  │  - Version History (Git commits)            ││
│  │  - Agent Checkpoints (PostgreSQL)           ││
│  └─────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────┐│
│  │          Failure Recovery Layer             ││
│  │  - Retry with exponential backoff           ││
│  │  - Rollback to last checkpoint              ││
│  │  - Failure taxonomy + recovery strategies   ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

---

### Harness Design Patterns

#### Pattern 1: Dual-Phase Execution (Initializer + Worker)

**Initializer** (runs once per project):

- Scaffold project directory structure
- Load characters, locations, style guide
- Create task registry
- Initialize memory system

**Worker** (runs per task/episode):

- Review task registry for next assignment
- Load context from session log
- Execute agent workflow
- Update progress and commit

```typescript
interface HarnessInitializer {
  initialize(projectId: string): Promise<InitializedState>
}

interface HarnessWorker {
  executeOneTask(state: InitializedState): Promise<TaskResult>
}
```

**Implementation:**

```typescript
class WritingHarness implements HarnessInitializer, HarnessWorker {
  async initialize(projectId: string): Promise<InitializedState> {
    // Load project context
    const project = await projectRepository.findById(projectId)
    const characters = await characterRepository.findByProject(projectId)
    const locations = await locationRepository.findByProject(projectId)
    const memories = await memoryRepository.findByProject(projectId)

    // Create task registry
    const taskRegistry = await this.createTaskRegistry(projectId, project.episodeCount)

    // Create session log
    const sessionLog = await this.createSessionLog(projectId)

    return {
      projectId,
      project,
      characters,
      locations,
      memories,
      taskRegistry,
      sessionLog
    }
  }

  async executeOneTask(state: InitializedState): Promise<TaskResult> {
    // Find next pending task
    const task = await this.getNextPendingTask(state.taskRegistry)
    if (!task) return { status: 'no_tasks' }

    // Load context for this task
    const context = await this.loadTaskContext(state, task)

    // Execute agent workflow
    const orchestrator = getWritingOrchestrator()
    const result = await orchestrator.executeWritingTask({
      taskId: task.id,
      episodeNum: task.episodeNum,
      context
    })

    // Update task registry
    await this.markTaskComplete(state.taskRegistry, task.id, result)

    // Update session log
    await this.appendToSessionLog(state.sessionLog, {
      taskId: task.id,
      summary: result.summary,
      timestamp: new Date()
    })

    return { status: 'completed', task, result }
  }
}
```

---

#### Pattern 2: File-Backed State (Compaction-Stable)

**Problem:** LLM context windows truncate on long runs, losing state held only in transient memory.

**Solution:** Externalize state to file-backed artifacts that survive truncation.

```typescript
// Task Registry (JSON format - models are "less likely to inappropriately change" JSON vs text)
interface TaskRegistry {
  projectId: string
  tasks: TaskEntry[]
}

interface TaskEntry {
  id: string
  episodeNum: number
  type: 'outline' | 'draft' | 'critique' | 'revision'
  status: 'pending' | 'running' | 'completed' | 'failed'
  requiredArtifacts: string[] // Paths to expected outputs
  completedAt?: string
  error?: string
}

// Session Log (append-only, survives context reset)
interface SessionLog {
  projectId: string
  entries: SessionEntry[]
}

interface SessionEntry {
  timestamp: string
  taskId: string
  agentType: string
  summary: string // Compressed step summary
  artifacts: string[] // Paths to outputs
  metrics?: {
    durationMs: number
    tokenUsage: number
    critiqueScore?: number
  }
}
```

**Storage Structure:**

```
projects/{projectId}/
├── .harness/
│   ├── task-registry.json      # Machine-readable task state
│   ├── session-log.json        # Step summaries for context recovery
│   └── checkpoints/
│       ├── outline-ep3.json    # Agent-specific checkpoints
│       ├── draft-ep3.json
│       └── critique-ep3.json
├── episodes/
│   ├── ep1-outline.json
│   ├── ep1-draft.json
│   └── ep1-final.json
└── context/
    ├── characters.json
    ├── locations.json
    └── memories.json
```

**Key Property:** State is **path-addressable** - any agent can reopen exact artifacts by path, even after context reset.

---

#### Pattern 3: Context Management (Reset + Compaction)

**Context Window Monitoring:**

```typescript
class ContextMonitor {
  private tokenCount = 0
  private readonly MAX_TOKENS = 128000 // Model-specific limit
  private readonly COMPACTION_THRESHOLD = 0.8 // Trigger at 80%

  addMessage(message: AgentMessage): void {
    this.tokenCount += this.estimateTokens(message)

    if (this.needsCompaction()) {
      this.triggerCompaction()
    }
  }

  needsCompaction(): boolean {
    return this.tokenCount > this.MAX_TOKENS * this.COMPACTION_THRESHOLD
  }

  async triggerCompaction(): Promise<CompactedContext> {
    // Compress dialogue history into structured summary
    const summary = await this.compactHistory()

    // Reset context with essential state only
    this.tokenCount = 0 // Reset counter
    return {
      summary,
      essentialState: this.extractEssentialState(),
      artifactPaths: this.currentArtifactPaths()
    }
  }
}
```

**Context Reset + State Passing:**

```typescript
interface ContextResetStrategy {
  // When context window is near capacity
  async resetContext(state: AgentState): Promise<FreshContext> {
    // 1. Compress completed sub-trajectories
    const compressed = await this.compactHistory(state.dialogueHistory)

    // 2. Extract essential state (must survive reset)
    const essentialState = {
      currentTask: state.currentTask,
      outline: state.outline, // Structured, compact
      critiqueScores: state.critiqueScores,
      revisionCount: state.revisionCount,
      artifactPaths: state.artifactPaths // References to file-backed state
    }

    // 3. Create fresh context
    return {
      system: state.systemPrompt,
      context: essentialState,
      history: compressed // Summarized history instead of full dialogue
    }
  }

  private async compactHistory(history: Message[]): Promise<string> {
    // Use LLM to compress dialogue into structured summary
    const summaryPrompt = `
      Compress the following agent dialogue into a structured summary.
      Preserve: decisions made, artifacts created, current state.
      Discard: redundant reasoning, failed attempts, verbose explanations.
    `
    return await llm.summarize(summaryPrompt, history)
  }
}
```

**Two-Fold Solution (Anthropic Pattern):**

1. **Context Reset:** Clear window and start fresh agent, passing only essential state
2. **Compaction:** Preserve continuity by summarizing completed sections into structured metadata

---

#### Pattern 4: Failure Taxonomy + Recovery

```typescript
type FailureMode =
  | 'missing_artifact' // Expected output file not found
  | 'wrong_path' // Agent wrote to wrong location
  | 'verifier_failure' // Critic agent scored below threshold
  | 'tool_error' // LLM API call failed
  | 'timeout' // Agent exceeded time limit
  | 'context_overflow' // Context window exceeded
  | 'parse_error' // LLM output couldn't be parsed

interface RecoveryStrategy {
  mode: FailureMode
  action: 'retry' | 'rollback' | 'skip' | 'escalate'
  maxRetries: number
  fallback?: () => Promise<unknown>
}

const FAILURE_RECOVERY_MAP: Record<FailureMode, RecoveryStrategy> = {
  missing_artifact: {
    mode: 'missing_artifact',
    action: 'retry',
    maxRetries: 2,
    fallback: () => regenerateArtifact()
  },
  wrong_path: {
    mode: 'wrong_path',
    action: 'retry',
    maxRetries: 1
  },
  verifier_failure: {
    mode: 'verifier_failure',
    action: 'retry',
    maxRetries: 3, // Revision loop
    fallback: () => escalateToHuman()
  },
  tool_error: {
    mode: 'tool_error',
    action: 'retry',
    maxRetries: 3
  },
  timeout: {
    mode: 'timeout',
    action: 'rollback',
    maxRetries: 1
  },
  context_overflow: {
    mode: 'context_overflow',
    action: 'retry', // After context reset
    maxRetries: 1
  },
  parse_error: {
    mode: 'parse_error',
    action: 'retry',
    maxRetries: 2
  }
}
```

**Recovery Execution:**

```typescript
class FailureRecoveryManager {
  async handleFailure(failure: Failure): Promise<RecoveryResult> {
    const strategy = FAILURE_RECOVERY_MAP[failure.mode]

    if (failure.retryCount >= strategy.maxRetries) {
      // Max retries exceeded, use fallback or escalate
      if (strategy.fallback) {
        return await strategy.fallback()
      }
      return { status: 'escalated', failure }
    }

    // Execute recovery action
    switch (strategy.action) {
      case 'retry':
        return await this.retryAgent(failure, strategy)
      case 'rollback':
        return await this.rollbackToCheckpoint(failure)
      case 'skip':
        return await this.skipTask(failure)
      case 'escalate':
        return await this.escalateToHuman(failure)
    }
  }

  private async retryAgent(failure: Failure, strategy: RecoveryStrategy): Promise<RecoveryResult> {
    // Reload from last checkpoint
    const state = await this.checkpointManager.restore(failure.jobId, failure.agentType)

    // Retry with exponential backoff
    const delay = Math.pow(2, failure.retryCount) * 1000
    await this.sleep(delay)

    // Re-execute agent
    return await this.agentExecutor.execute(failure.agentType, state)
  }
}
```

---

#### Pattern 5: Parent-Child Delegation (Orchestrator Hierarchy)

**Principle:** Top-level agent is orchestrator, not direct worker. Substantive work happens inside child agents.

```typescript
class WritingOrchestrator {
  // Parent role: coordinate, don't generate content directly
  async executeWritingTask(request: WritingRequest): Promise<WritingResult> {
    // 1. Delegate outline to child agent
    const outlineAgent = this.createChildAgent('outline', {
      context: this.loadContext(request)
    })
    const outline = await outlineAgent.execute()

    // 2. Delegate draft to child agent
    const draftAgent = this.createChildAgent('draft', {
      outline,
      context: this.loadContext(request)
    })
    const draft = await draftAgent.execute()

    // 3. Delegate critique to child agent
    const criticAgent = this.createChildAgent('critic', {
      draft,
      evaluationCriteria: this.getCriteria(request)
    })
    const critique = await criticAgent.execute()

    // 4. Synthesize results
    return this.synthesizeResults({ outline, draft, critique })
  }

  private createChildAgent(agentType: string, context: unknown): Agent {
    return new WritingAgent({
      type: agentType,
      context,
      harness: this.harness, // Share harness instance
      checkpointManager: this.checkpointManager
    })
  }
}
```

**Benefits:**

- Each child agent has isolated context window
- Parent maintains global state
- Child failures don't corrupt parent state
- Easier to parallelize (each child is independent)

---

### Harness Runtime Implementation

```typescript
interface WritingHarnessRuntime {
  // Lifecycle
  initialize(projectId: string): Promise<HarnessState>
  shutdown(projectId: string): Promise<void>

  // Task execution
  executeNextTask(state: HarnessState): Promise<TaskResult>
  cancelTask(taskId: string): Promise<void>

  // Context management
  compactContext(state: HarnessState): Promise<HarnessState>
  resetContext(state: HarnessState, preservePaths: string[]): Promise<HarnessState>

  // State persistence
  saveCheckpoint(state: HarnessState, agentType: string): Promise<void>
  restoreCheckpoint(jobId: string, agentType: string): Promise<HarnessState | null>

  // Failure recovery
  handleFailure(failure: Failure): Promise<RecoveryResult>

  // Metrics
  getMetrics(projectId: string): Promise<HarnessMetrics>
}

class WritingHarness implements WritingHarnessRuntime {
  private contextMonitor: ContextMonitor
  private checkpointManager: CheckpointManager
  private failureRecovery: FailureRecoveryManager
  private taskRegistry: TaskRegistryManager
  private sessionLog: SessionLogManager

  async initialize(projectId: string): Promise<HarnessState> {
    // Create project directory structure
    const dirStructure = await this.scaffoldProjectDirectory(projectId)

    // Load project context from database
    const projectContext = await this.loadProjectContext(projectId)

    // Initialize task registry
    this.taskRegistry = await TaskRegistryManager.create(projectId, projectContext.episodeCount)

    // Initialize session log
    this.sessionLog = await SessionLogManager.create(projectId)

    // Initialize context monitor
    this.contextMonitor = new ContextMonitor()

    return {
      projectId,
      phase: 'initialized',
      context: projectContext,
      directory: dirStructure,
      taskRegistry: this.taskRegistry,
      sessionLog: this.sessionLog
    }
  }

  async executeNextTask(state: HarnessState): Promise<TaskResult> {
    // Find next pending task
    const task = await this.taskRegistry.getNextPending()
    if (!task) return { status: 'no_tasks' }

    // Load task context from file-backed state
    const taskContext = await this.loadTaskContext(state, task)

    // Create child agent with harness
    const agent = new WritingAgent({
      type: task.type,
      context: taskContext,
      harness: this,
      checkpointManager: this.checkpointManager
    })

    try {
      // Execute with monitoring
      const result = await agent.execute()

      // Update task registry
      await this.taskRegistry.markComplete(task.id, result)

      // Append to session log
      await this.sessionLog.append({
        taskId: task.id,
        agentType: task.type,
        summary: result.summary,
        artifacts: result.artifactPaths,
        metrics: result.metrics
      })

      // Commit to version control (if using Git)
      await this.commitProgress(task, result)

      return { status: 'completed', task, result }
    } catch (error) {
      // Handle failure with recovery
      const failure = this.classifyFailure(error, task)
      return await this.failureRecovery.handleFailure(failure)
    }
  }

  private classifyFailure(error: Error, task: TaskEntry): Failure {
    if (error.message.includes('context length')) {
      return { mode: 'context_overflow', task, error, retryCount: 0 }
    }
    if (error.message.includes('timeout')) {
      return { mode: 'timeout', task, error, retryCount: 0 }
    }
    if (error.message.includes('parse')) {
      return { mode: 'parse_error', task, error, retryCount: 0 }
    }
    // Default: tool error
    return { mode: 'tool_error', task, error, retryCount: 0 }
  }

  private async commitProgress(task: TaskEntry, result: TaskResult): Promise<void> {
    // Optional: Git commit for version history
    if (process.env.ENABLE_HARNESS_GIT_TRACKING) {
      await exec(`git add projects/${task.projectId}/`)
      await exec(`git commit -m "harness: complete ${task.type} for episode ${task.episodeNum}"`)
    }
  }
}
```

---

### Integration with Existing Code

**Phase 1: Foundation (Minimal Changes)**

**Leverage existing:**

- `MemoryService` for context building
- `PipelineOrchestrator` for step execution
- `ScriptWriter` functions for LLM calls
- `ModelApiCall` logging for observability

**Add new:**

- `WritingOrchestrator` class
- `CriticAgent` (new)
- `AgentCheckpoint` model (new)
- Message types and interfaces
- **Harness layer** (context management, file-backed state)

**Phase 2: Agent Specialization**

**Refactor existing:**

- Split `writeScriptFromIdea` into `OutlineAgent` + `DraftAgent`
- Extract `showrunnerReviewOutlines` into `CriticAgent`
- Make `improveScript` into `RevisionAgent`

**Add new:**

- `StyleAgent`
- `ResearchAgent` (optional)
- Checkpoint manager
- **Harness runtime with compaction**

**Phase 3: Advanced Features**

- Parallel execution for multi-episode projects
- Event-driven pub-sub for real-time progress
- HITL (Human-in-the-Loop) approval gates
- Time-travel for regenerating specific episodes
- **Self-evolving harness** (adjust strategies based on metrics)

---

## Implementation Roadmap

### Step 1: Define Agent Interfaces

Create `packages/backend/src/services/agents/types.ts`:

```typescript
export interface Agent<TInput, TOutput> {
  name: string
  execute(input: TInput): Promise<TOutput>
  validate(input: TInput): ValidationResult
}

export interface AgentConfig {
  maxRetries: number
  timeoutMs: number
  modelProvider: string
  model: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}
```

### Step 2: Implement Critic Agent (Highest ROI)

Create `packages/backend/src/services/agents/critic-agent.ts`:

```typescript
export class CriticAgent implements Agent<ScriptContent, CritiqueResult> {
  readonly name = 'critic'

  async execute(draft: ScriptContent): Promise<CritiqueResult> {
    // LLM call with evaluation prompt
    // Parse structured response
    // Return scores + feedback
  }
}
```

### Step 3: Build Orchestrator

Create `packages/backend/src/services/agents/writing-orchestrator.ts`:

```typescript
export class WritingOrchestrator {
  private outlineAgent: OutlineAgent
  private draftAgent: DraftAgent
  private criticAgent: CriticAgent
  private revisionAgent: RevisionAgent
  private checkpointManager: CheckpointManager

  async executeWritingTask(request: WritingRequest): Promise<WritingResult> {
    // Load context from Memory System
    // Execute agent workflow
    // Save checkpoints
    // Update Memory System
    // Return result
  }
}
```

### Step 4: Add Checkpoint Model

Add to `schema.prisma`:

```prisma
model AgentCheckpoint {
  id          String   @id @default(cuid())
  jobId       String
  agentType   String
  phase       String
  state       Json
  version     Int      @default(1)
  createdAt   DateTime @default(now())

  @@index([jobId])
}
```

### Step 5: Integrate with Existing Pipeline

Modify `episode-storyboard-job.ts` to use orchestrator:

```typescript
// Before: Direct LLM call
const result = await episodeService.generateEpisodeStoryboardScript(...)

// After: Agent-based
const orchestrator = getWritingOrchestrator()
const result = await orchestrator.executeWritingTask({
  type: 'episode_storyboard',
  episodeId,
  userId,
  context: { /* from Memory System */ }
})
```

---

## Key Design Decisions

### Decision 1: Why Not LangGraph?

**Pros of LangGraph:**

- Built-in checkpointing and time-travel
- State graph visualization
- HITL support

**Cons:**

- Python-only (our stack is TypeScript)
- Adds external dependency
- Overkill for current needs

**Decision:** Implement LangGraph-inspired patterns natively in TypeScript using existing Prisma + PostgreSQL infrastructure.

### Decision 2: Message Passing vs. Shared Memory

**Message Passing:**

- ✅ Explicit data flow, easier to debug
- ✅ Type-safe with TypeScript
- ❌ Requires defining all message types upfront

**Shared Memory:**

- ✅ Simple to implement
- ✅ Flexible (agents can read any state)
- ❌ Harder to track data dependencies

**Decision:** Use **both** - structured messages for inter-agent handoffs, shared state (database) for persistent context.

### Decision 3: How Many Agents to Start?

**Recommendation:** Start with **3 core agents**:

1. Outline Agent (extends existing)
2. Draft Agent (extends existing)
3. Critic Agent (new, highest ROI)

Add Revision, Style, Research agents based on user feedback and quality metrics.

---

## Quality Metrics & Evaluation

### Agent Performance Tracking

```typescript
interface AgentMetrics {
  agentType: string
  totalExecutions: number
  averageScore: number // From Critic Agent
  averageRevisions: number // How many iterations needed
  averageDurationMs: number
  failureRate: number
  userSatisfactionScore?: number // From user ratings
}
```

### Continuous Improvement

1. **Track pass/fail rates** per agent
2. **Log critique scores** to identify weak agents
3. **A/B test prompts** to improve quality
4. **User feedback loop** - let users rate generated content
5. **Prompt evolution** - automatically adjust based on metrics

---

## Risk Mitigation

### Risk 1: Infinite Revision Loops

**Mitigation:**

- Max revision limit (default: 3)
- Each revision must address specific issues
- Log all revisions for debugging

### Risk 2: Context Window Overflow

**Mitigation:**

- Use Memory System's `buildEpisodeWritingContext` (already compresses)
- Implement history compression (StoryWriter pattern)
- Fallback to summarization if context too large

### Risk 3: Agent State Divergence

**Mitigation:**

- Single source of truth (database)
- Checkpoints at every agent boundary
- Validation before state transitions

### Risk 4: Cost Explosion

**Mitigation:**

- Track all LLM calls via `ModelApiCall`
- Set per-job budget limits
- Alert on unusual spending patterns

---

## Next Steps

1. **Review this design** with team
2. **Prioritize implementation phases**
3. **Create detailed spec** for Phase 1 (Critic Agent + Orchestrator)
4. **Implement incrementally** with tests at each step
5. **Gather metrics** before/after to validate improvements

---

## References

### Harness Engineering (Anthropic & Research)

- **Effective Harnesses for Long-Running Agents** - Anthropic Engineering (2025)
  - Context reset + compaction patterns
  - Dual-phase harness (initializer + worker)
  - File-backed state management
- **Natural-Language Agent Harnesses** - arXiv 2603.25723v1 (2026)
  - Intelligent Harness Runtime (IHR)
  - Parent-child delegation patterns
  - Contract-first completion
  - Self-evolution for alignment
- **Harness-Managed Virtual Memory for Stateful Tool-Using LLM Agents** - arXiv 2604.10352v1 (2026)
  - Context window as virtual memory
  - Compaction-stable state persistence
- **Claude Code Harness Engineering** - Deep dive analysis (qingkeai.online, 2026)
  - Prompt/Context/Harness triad
  - Context engineering strategies

### Academic Papers

- StoryWriter (arXiv 2025) - 3-module pipeline with history compression
- Agents' Room (ICLR 2025) - Character simulation + narrative theory
- SuperWriter-Agent (OpenReview 2025) - Reflection-driven generation
- bMAS Framework - Blackboard-based multi-agent coordination

### Frameworks

- LangGraph - State graphs, checkpointing, HITL
- CrewAI - Role-based agent teams
- AutoGen - Conversational multi-agent systems

### Industry Examples

- Jasper AI - Content pipelines with brand alignment
- Notion AI - Hierarchical agent coordination
- Copy.ai - Workflow-based content generation
- Anthropic Claude Code - Production harness implementation
