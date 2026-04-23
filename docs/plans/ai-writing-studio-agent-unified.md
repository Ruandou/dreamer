# AI Writing Studio Agent - Unified Design

> 整合版设计：AI 写作工作室对外呈现为单一 Agent，内部采用多 Agent + Harness 架构

---

## Overview

### Design Philosophy

**对外：单一智能体**

- 用户在 `/studio` 与一个"AI 编剧 Agent"对话
- 输入自然语言指令（如"写一个穿越剧，主角回到明朝"）
- Agent 分步展示结果，每步可确认/修改

**对内：多 Agent 协作 + Harness 管理**

- Orchestrator 协调 Outline → Draft → Critic → Revision 流水线
- Harness 管理上下文窗口、状态持久化、故障恢复
- 剧本独立记忆空间，定稿后同步到项目 Memory System

```
┌─────────────────────────────────────────────────┐
│              User View (Studio)                  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  🎬 AI 编剧 Agent                         │  │
│  │  "我理解你想写一个 5 集穿越剧，对吗？"     │  │
│  │  [✅ 确认] [✏️ 修改要求]                   │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│            Internal Architecture                 │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  Writing Studio Agent (Facade)            │  │
│  │  - Intent Parser (意图解析)               │  │
│  │  - Context Loader (上下文加载)            │  │
│  │  - Response Builder (响应构建)            │  │
│  └─────────────────┬─────────────────────────┘  │
│                    │                             │
│  ┌─────────────────▼─────────────────────────┐  │
│  │  Writing Harness (Runtime)                │  │
│  │  - Context Management (窗口管理)          │  │
│  │  - Checkpoint Manager (状态持久化)        │  │
│  │  - Failure Recovery (故障恢复)            │  │
│  └─────────────────┬─────────────────────────┘  │
│                    │                             │
│  ┌─────────────────▼─────────────────────────┐  │
│  │  Writing Orchestrator (Coordinator)       │  │
│  │  ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────┐ │  │
│  │  │ Outline  │→│Draft │→│Critic│→│Revise│ │  │
│  │  │ Agent    │ │Agent │ │Agent │ │Agent │ │  │
│  │  └──────────┘ └──────┘ └──────┘ └──────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  Memory Layer                             │  │
│  │  - ScriptMemoryItem (剧本独立记忆)        │  │
│  │  - MemoryItem (项目记忆，可选加载)        │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## User Interaction Model

### Studio 界面布局

```
┌──────────────────────────────────────────────────────────────────────┐
│  ✍️ AI 写作工作室    [标题可编辑]  [👁️预览] [✏️编辑] [📥导出] [🤖Agent]│
├──────────────────────────────────────────┬───────────────────────────┤
│                                          │  🎬 AI 编剧 Agent         │
│         编辑 / 预览区                     │  ───────────────────────  │
│         (textarea / preview)             │                           │
│                                          │  💬 Agent 对话区           │
│   Scene 1. 破旧屋内 - 夜                  │  ┌───────────────────────┐│
│                                          │  │ Agent: 大纲已生成，    ││
│   昏暗压抑，远处传来更鼓声...              │  │ 请确认后继续生成草稿  ││
│                                          │  │                       ││
│   宋应星："这是……哪里？"                  │  │ [✅ 确认] [✏️ 修改]   ││
│                                          │  └───────────────────────┘│
│                                          │                           │
│                                          │  ───────────────────────  │
│                                          │  📋 步骤进度               │
│                                          │  ✅ 意图解析               │
│                                          │  ✅ 加载上下文             │
│                                          │  🔄 生成大纲 (当前)        │
│                                          │  ⏳ 生成草稿               │
│                                          │  ⏳ 审核修改               │
│                                          │                           │
│                                          │  ───────────────────────  │
│                                          │  💬 输入指令...            │
│                                          │  [✨ 执行]                │
└──────────────────────────────────────────┴───────────────────────────┘
```

### 交互流程

#### 场景 1：生成新剧本

```
用户输入："写一个穿越剧，主角是现代人回到明朝当科学家"
     ↓
Agent 解析意图 → 确认理解
     "我理解你想写：
      - 类型：穿越
      - 背景：明朝
      - 主角：现代科学家
      - 建议集数：5 集
      对吗？"
     ↓
用户确认 ✅
     ↓
Agent 生成大纲 → 展示在右侧面板
     "✅ 大纲已生成，共 5 集：
      第1集：穿越 - 现代科学家李明意外穿越...
      第2集：初到明朝 - 李明发现自己在太医院...
      ...
      [✅ 确认大纲] [✏️ 修改指令]"
     ↓
用户确认 ✅
     ↓
Agent 生成草稿（内部：Draft → Critic → Revise 循环）
     → 展示在左侧编辑器
     "✅ 草稿已生成，请审核
      [✅ 接受] [✏️ 输入修改指令]"
     ↓
用户接受 ✅
     ↓
Agent 保存到数据库，记忆写入 ScriptMemoryItem 表
     → 提示："剧本已保存。是否同步到项目记忆？"
```

#### 场景 2：局部修改

```
用户选中文本 → 输入："让这段对话更紧张一些"
     ↓
Agent 解析意图 → 局部修改模式
     ↓
Agent 加载上下文（剧本记忆 + 选中内容 + 全文）
     ↓
Agent 修改 → 展示差异对比 Modal
     ↓
用户接受 → 更新编辑器内容，自动保存
```

---

## Internal Agent Architecture

### 7 Agent Roles (Internal)

| Agent                    | Responsibility           | User Visible?       |
| ------------------------ | ------------------------ | ------------------- |
| **Writing Orchestrator** | 协调流水线，管理状态转换 | ❌ 内部             |
| **Intent Parser**        | 理解用户指令，提取参数   | ✅ 部分（确认理解） |
| **Context Loader**       | 加载剧本记忆、项目上下文 | ❌ 内部             |
| **Outline Agent**        | 生成结构大纲             | ✅ 展示大纲         |
| **Draft Agent**          | 基于大纲生成完整剧本     | ✅ 展示草稿         |
| **Critic Agent**         | 内部审核质量             | ❌ 内部             |
| **Revision Agent**       | 根据审核意见修改         | ❌ 内部             |

### Agent Pipeline (Hidden from User)

```
User Command
    ↓
[Intent Parser] 解析意图 → 生成结构化参数
    ↓
[Context Loader] 加载上下文
    - ScriptMemoryItem (剧本记忆)
    - MemoryItem (项目记忆，如果关联)
    - 前情摘要
    ↓
[Orchestrator] 创建执行计划
    ↓
[Outline Agent] 生成大纲
    ↓ (save to ScriptMemoryItem)
    ↓ (show to user)
User: Confirm / Revise
    ↓
[Draft Agent] 生成完整剧本
    ↓ (save to ScriptMemoryItem)
    ↓
[Critic Agent] 内部审核 (用户不可见)
    ↓ (if score < 75)
[Revision Agent] 自动修改
    ↓
[Orchestrator] 展示最终稿给用户
    ↓
User: Accept / Revise
    ↓ (if accept)
[Context Loader] 更新记忆
    ↓
Save to Script table + ScriptMemoryItem table
```

---

## Memory Architecture

### Two-Level Memory System

```
┌─────────────────────────────────────┐
│  Level 1: Script Memory (Draft)     │
│  - 每个 Script 独立记忆空间          │
│  - 草稿阶段使用                      │
│  - 不污染项目记忆                    │
│  - 表：ScriptMemoryItem              │
└──────────────┬──────────────────────┘
               │ 定稿/立项时同步
               ▼
┌─────────────────────────────────────┐
│  Level 2: Project Memory (Production)│
│  - 项目级记忆，所有集共享            │
│  - 已验证、精炼的内容                │
│  - 表：MemoryItem (existing)         │
└─────────────────────────────────────┘
```

### ScriptMemoryItem Schema

```prisma
model ScriptMemoryItem {
  id          String   @id @default(cuid())
  scriptId    String
  script      Script   @relation(fields: [scriptId], references: [id], onDelete: Cascade)

  // 分类（与 MemorySystem 对齐）
  type        MemoryType  // CHARACTER, LOCATION, EVENT, PLOT_POINT, FORESHADOWING, RELATIONSHIP
  category    String?     // major_character, minor_location, etc.

  // 内容
  title       String
  content     String   @db.Text
  metadata    Json?    // { episodeNum, characters, location, importance }

  // 管理
  tags        String[] @default([])
  importance  Int      @default(3)  // 1-5
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([scriptId, type])
  @@index([scriptId, isActive])
}

// Script 表扩展
model Script {
  // ... existing fields ...

  // 新增字段
  targetEpisode     Int?               // 目标集数
  generationStatus  Json?              // { step, outline, draft, memories }
  memories          ScriptMemoryItem[] // 关联记忆
}
```

### Memory Sync Flow

```typescript
// 触发时机：用户点击"立项"或标记剧本为 READY
async function syncScriptMemoriesToProject(scriptId: string, projectId: string) {
  const scriptMemories = await scriptMemoryRepository.findByScript(scriptId)

  for (const sm of scriptMemories) {
    // Upsert by type + title (idempotent)
    const existing = await memoryRepository.findByProjectAndTitle(projectId, sm.type, sm.title)

    if (existing) {
      await memoryRepository.update(existing.id, {
        content: sm.content,
        metadata: sm.metadata,
        tags: sm.tags,
        importance: sm.importance
      })
    } else {
      await memoryRepository.create({
        projectId,
        type: sm.type,
        title: sm.title,
        content: sm.content,
        metadata: sm.metadata,
        tags: sm.tags,
        importance: sm.importance
      })
    }
  }

  return { synced: scriptMemories.length }
}
```

---

## Harness Integration

### Why Harness?

AI 写作工作室的 Agent 需要：

- **长任务管理**：生成多集剧本可能耗时较长
- **上下文窗口管理**：多轮对话 + 大量上下文容易超限
- **状态持久化**：用户刷新页面后能恢复进度
- **故障恢复**：LLM 调用失败能自动重试

### Harness Architecture

```
┌─────────────────────────────────────────────────┐
│           Writing Studio Harness                │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐  │
│  │  Context Management Layer                 │  │
│  │  - Token counting & monitoring            │  │
│  │  - Compaction at 80% threshold            │  │
│  │  - Context reset + state passing          │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  State Persistence Layer                  │  │
│  │  - Script.generationStatus (JSON)         │  │
│  │  - AgentCheckpoint (PostgreSQL)           │  │
│  │  - Session Log (append-only)              │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Failure Recovery Layer                   │  │
│  │  - Retry with exponential backoff         │  │
│  │  - Rollback to checkpoint                 │  │
│  │  - 7 failure modes + strategies           │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Context Management

```typescript
class ContextMonitor {
  private tokenCount = 0
  private readonly MAX_TOKENS = 128000
  private readonly COMPACTION_THRESHOLD = 0.8

  addMessage(message: AgentMessage): void {
    this.tokenCount += this.estimateTokens(message)

    if (this.needsCompaction()) {
      this.triggerCompaction()
    }
  }

  async triggerCompaction(): Promise<CompactedContext> {
    // 1. Compress dialogue history
    const summary = await this.compactHistory()

    // 2. Extract essential state
    const essentialState = {
      currentTask: this.currentTask,
      outline: this.outline,
      critiqueScores: this.critiqueScores,
      artifactPaths: this.currentArtifactPaths()
    }

    // 3. Reset counter
    this.tokenCount = 0

    return { summary, essentialState }
  }
}
```

### Checkpoint Schema

```prisma
model AgentCheckpoint {
  id          String   @id @default(cuid())
  scriptId    String   // 关联到 Script
  agentType   String   // "outline", "draft", "critic", "revision"
  phase       String   // "generating", "reviewing", "revising"
  state       Json     // Serialized agent state
  version     Int      @default(1)
  createdAt   DateTime @default(now())

  @@index([scriptId])
  @@index([agentType])
}
```

### Failure Taxonomy

| Failure Mode       | Recovery Strategy         | Max Retries |
| ------------------ | ------------------------- | ----------- |
| `missing_artifact` | Retry + regenerate        | 2           |
| `verifier_failure` | Auto-revise (Critic loop) | 3           |
| `tool_error`       | Retry with backoff        | 3           |
| `timeout`          | Rollback to checkpoint    | 1           |
| `context_overflow` | Reset context + retry     | 1           |
| `parse_error`      | Retry                     | 2           |

---

## API Design

### Endpoints

```
# Agent 主入口
POST /api/scripts/:id/agent
Request: {
  command: string,           // 用户指令
  context?: {
    selectedText?: string,   // 选中文本
    targetEpisode?: number   // 目标集数
  }
}
Response: {
  type: 'intent_confirm' | 'outline' | 'draft' | 'revision' | 'error'
  content: string | ScriptContent | OutlineOutput
  metadata: {
    step: number
    totalSteps: number
    requiresUserAction: boolean
    actionLabel: string  // "确认大纲" / "审核草稿" / ...
  }
  memories: ScriptMemoryItem[]
}

# 确认步骤
POST /api/scripts/:id/agent/confirm
Request: {
  action: 'confirm' | 'revise'
  revisionInstruction?: string  // if action = 'revise'
}
Response: {
  type: 'draft' | 'revision' | 'complete'
  content: ...
  metadata: ...
}

# 记忆管理
GET   /api/scripts/:id/memories               # 查看剧本记忆
POST  /api/scripts/:id/agent/memories/sync    # 同步到项目
Request: { projectId: string }
Response: { synced: number }
```

### Integration with Existing APIs

```
# 现有 API（保留）
GET    /api/scripts/latest      # 获取最新草稿
PUT    /api/scripts/:id         # 更新剧本
POST   /api/scripts/:id/ai-revise  # 现有 AI 修改（可与 Agent 并存）

# 新增 API
POST   /api/scripts/:id/agent              # Agent 主入口
POST   /api/scripts/:id/agent/confirm      # 确认步骤
GET    /api/scripts/:id/memories           # 剧本记忆
POST  /api/scripts/:id/agent/memories/sync # 记忆同步
```

---

## Implementation Phases

### Phase 1: Foundation (2-3 days)

**Database:**

- [ ] Add `ScriptMemoryItem` model to `schema.prisma`
- [ ] Add `targetEpisode`, `generationStatus` to `Script` model
- [ ] Add `AgentCheckpoint` model
- [ ] Run `pnpm db:push`

**Backend - Core:**

- [ ] Create `packages/backend/src/services/agents/` directory
- [ ] Implement `IntentParser` (LLM-based intent extraction)
- [ ] Implement `ContextLoader` (load script + project memories)
- [ ] Create `packages/backend/src/services/agents/types.ts` (interfaces)

**Backend - API:**

- [ ] Create `packages/backend/src/routes/script-agent.ts`
- [ ] Implement `POST /api/scripts/:id/agent` (intent parsing + confirmation)
- [ ] Register route in `index.ts`

**Frontend:**

- [ ] Create `packages/frontend/src/components/AgentPanel.vue`
- [ ] Modify `Studio.vue` to toggle between `ChatPanel` and `AgentPanel`
- [ ] Add agent mode toggle button

**Testing:**

- [ ] Test `IntentParser` with various commands
- [ ] Test `ContextLoader` with/without project context

### Phase 2: Core Pipeline (3-4 days)

**Backend - Agents:**

- [ ] Implement `OutlineAgent` (generate structured outline)
- [ ] Implement `DraftAgent` (generate full script from outline)
- [ ] Implement `CriticAgent` (internal quality evaluation)
- [ ] Implement `RevisionAgent` (auto-revise based on critique)
- [ ] Implement `WritingOrchestrator` (coordinate pipeline)

**Backend - Pipeline:**

- [ ] Implement step execution flow (outline → draft → critique → revise)
- [ ] Add memory extraction from outline/draft
- [ ] Implement `POST /api/scripts/:id/agent/confirm` endpoint

**Frontend:**

- [ ] Implement agent state machine in `Studio.vue`
- [ ] Add outline preview in `AgentPanel`
- [ ] Add step progress indicator
- [ ] Add draft review with accept/revise buttons
- [ ] Add diff modal for revisions

**Harness:**

- [ ] Implement `ContextMonitor` (token counting + compaction)
- [ ] Implement checkpoint save/restore
- [ ] Add failure recovery with retry logic

**Testing:**

- [ ] Test full pipeline with mock LLM
- [ ] Test checkpoint save/restore
- [ ] Test failure recovery scenarios

### Phase 3: Memory & Polish (2-3 days)

**Memory:**

- [ ] Implement memory extraction from generated content
- [ ] Implement `syncScriptMemoriesToProject()` function
- [ ] Add `POST /api/scripts/:id/agent/memories/sync` endpoint
- [ ] Add `GET /api/scripts/:id/memories` endpoint
- [ ] Add memory viewer in `AgentPanel`

**Polish:**

- [ ] Add loading animations for each step
- [ ] Add cost estimation before generation
- [ ] Add agent usage history
- [ ] Add error handling with user-friendly messages
- [ ] Add agent cost tracking via `ModelApiCall`

**Testing:**

- [ ] Test memory sync with project
- [ ] Test end-to-end flow (command → save → sync)
- [ ] Integration tests with real LLM (optional)

---

## Key Design Decisions

### Decision 1: Single Agent Facade vs. Multi-Agent

**Why Single Agent Facade:**

- User experience is simpler (one agent to talk to)
- Matches existing Studio UX pattern
- Internal complexity is hidden from user
- Easy to add more internal agents later without changing UI

**Trade-off:**

- User has less visibility into internal steps
- Mitigation: Show step progress indicator ("生成大纲 → 生成草稿 → 审核修改")

### Decision 2: Script-Level Memory (Not Project-Level)

**Why:**

- Script is a **draft workspace** - messy, iterative, experimental
- Project memory should be **curated** - only finalized, validated content
- Allows users to experiment without polluting project memory
- Clean separation: draft vs. production

**Sync Trigger:**

- User clicks "立项" (create project from script)
- User marks script as "READY" status
- Manual sync button in Agent panel

### Decision 3: Step-by-Step (Not Fully Auto)

**Why:**

- User wants **control** over creative process
- Outline approval prevents wasted LLM calls on wrong direction
- Each step is a **checkpoint** - user can revise before proceeding
- More transparent than black-box auto-generation

**Trade-off:**

- Slower than fully auto, but higher quality output
- Future: Add "auto mode" for confident users

### Decision 4: Why Harness?

**Why:**

- Long-running tasks need context window management
- User may refresh page - need state persistence
- LLM calls may fail - need retry logic
- Based on Anthropic's proven patterns (arXiv 2603.25723)

**Trade-off:**

- More complex than simple function calls
- Mitigation: Harness is internal, doesn't affect API simplicity

### Decision 5: TypeScript Native (Not LangGraph)

**Why:**

- LangGraph is Python-only
- Our stack is TypeScript + Prisma + PostgreSQL
- Can implement LangGraph patterns natively
- No external dependency

**Implementation:**

- State graph → TypeScript state machine
- Checkpointing → PostgreSQL `AgentCheckpoint` table
- HITL → User confirmation in Studio UI

---

## Success Metrics

| Metric                       | Target                                                 |
| ---------------------------- | ------------------------------------------------------ |
| Agent usage rate             | > 50% of Studio sessions use Agent vs. manual commands |
| Outline approval rate        | > 80% approved on first try (minor revisions ok)       |
| Draft acceptance rate        | > 70% accepted after auto-revision                     |
| Average revisions per script | < 2 (including auto-revision)                          |
| User satisfaction            | > 4/5 stars in post-generation feedback                |
| Memory sync success rate     | > 95% (idempotent upsert)                              |

---

## Risks & Mitigations

### Risk 1: LLM Output Quality

**Mitigation:**

- Critic agent auto-revises before showing to user
- User can always revise manually
- Track critique scores to identify weak prompts
- A/B test prompts to improve quality

### Risk 2: Context Window Overflow

**Mitigation:**

- Harness `ContextMonitor` tracks token usage
- Compaction at 80% threshold
- Use Memory System's `buildEpisodeWritingContext` (already compresses)
- Generate episodes sequentially (not all at once)
- Fallback to summarization if context too large

### Risk 3: Memory Sync Conflicts

**Mitigation:**

- Sync is idempotent (upsert by type + title)
- Log all sync operations
- User can manually review/edit memories before sync
- Conflict resolution: Script memory wins (newer data)

### Risk 4: Cost Explosion

**Mitigation:**

- Track all LLM calls via existing `ModelApiCall`
- Show estimated cost before generation
- Set per-script budget limit (future enhancement)
- Critic loop has max 3 iterations (prevents infinite cost)

### Risk 5: User Confusion (Hidden Complexity)

**Mitigation:**

- Show step progress indicator
- Explain each step in plain language
- Provide clear action buttons (确认 / 修改)
- Allow user to switch back to manual ChatPanel mode

---

## Architecture Comparison

| Dimension  | Original Multi-Agent    | Studio Single Agent | **Unified Design**                 |
| ---------- | ----------------------- | ------------------- | ---------------------------------- |
| User View  | Multiple agents exposed | One agent interface | **One agent facade** ✅            |
| Internal   | 7 agents directly       | Simple LLM calls    | **7 agents + Harness** ✅          |
| Memory     | Project-level only      | No memory           | **Script + Project dual-level** ✅ |
| State      | No persistence          | Transient           | **Checkpoint + Harness** ✅        |
| Context    | Manual loading          | Editor content only | **Multi-source context** ✅        |
| Recovery   | None                    | None                | **Failure taxonomy + retry** ✅    |
| Complexity | High                    | Low                 | **Internal high, external low** ✅ |

---

## Next Steps

1. **Review this unified design** - Confirm architecture and approach
2. **Start Phase 1** - Database schema + IntentParser + ContextLoader + AgentPanel
3. **Build Phase 2** - Core pipeline (Outline → Draft → Critic → Revise)
4. **Implement Phase 3** - Memory sync + polish
5. **Test end-to-end** - Full flow from user command to saved script + memory sync

---

## References

### Harness Engineering

- **Effective Harnesses for Long-Running Agents** - Anthropic Engineering (2025)
- **Natural-Language Agent Harnesses** - arXiv 2603.25723v1 (2026)
- **Harness-Managed Virtual Memory** - arXiv 2604.10352v1 (2026)

### Multi-Agent Patterns

- StoryWriter (arXiv 2025) - 3-module pipeline
- SuperWriter-Agent (OpenReview 2025) - Reflection-driven generation
- Agents' Room (ICLR 2025) - Character simulation

### Existing Codebase

- Memory System: `services/memory/`
- Pipeline Orchestrator: `services/pipeline-orchestrator.ts`
- Script Writer: `services/script-writer.ts`
- AI Writing Studio: `views/Studio.vue`, `routes/scripts.ts`
