# AI Writing Studio Agent Design

> 为 Dreamer AI 写作工作室设计的单一 Agent，支持分步确认的剧本自动生成流程

---

## Overview

### Design Goal

在现有 AI 写作工作室（`/studio`）基础上，引入一个**智能编剧 Agent**：

- 用户在右侧面板输入创作意图（如"写一个穿越剧，主角是现代人回到明朝"）
- Agent **分步生成**：大纲 → 用户确认 → 草稿 → 用户审核 → 修改
- Agent 读取**剧本独立记忆** + 项目记忆 + 前情摘要
- 剧本定稿/立项后，记忆同步到 Project Memory System

### Current vs. Target

| Dimension | Current Studio            | Target with Agent                     |
| --------- | ------------------------- | ------------------------------------- |
| AI 能力   | 单轮指令修改（续写/润色） | 全流程剧本生成（大纲→草稿→审核→修改） |
| 上下文    | 仅当前编辑器内容          | 剧本记忆 + 项目设定 + 前情摘要        |
| 工作流    | 用户手动输入指令          | Agent 分步引导，每步可确认/修改       |
| 记忆管理  | 无独立记忆                | 剧本独立记忆空间，定稿后同步到项目    |

---

## Agent Architecture

### Single Agent with Internal Pipeline

```
┌─────────────────────────────────────────────────┐
│           AI Writing Studio Agent               │
├─────────────────────────────────────────────────┤
│                                                 │
│  User Input (对话式指令)                         │
│       ↓                                         │
│  ┌─────────────────────┐                        │
│  │  Intent Parser      │ ← 理解用户意图          │
│  │  (意图解析)          │   - 生成新剧本          │
│  └────────┬────────────┘   - 修改现有内容        │
│           ↓                - 续写/扩写            │
│                                                 │
│  ┌─────────────────────┐                        │
│  │  Context Loader     │ ← 加载上下文            │
│  │  (上下文加载)        │   - 剧本独立记忆        │
│  └────────┬────────────┘   - 项目记忆             │
│           ↓                - 前情摘要             │
│                                                 │
│  ┌─────────────────────┐                        │
│  │  Step Executor      │ ← 执行当前步骤          │
│  │  (步骤执行器)        │   - 生成大纲            │
│  └────────┬────────────┘   - 生成草稿            │
│           ↓                - 审核/修改            │
│                                                 │
│  ┌─────────────────────┐                        │
│  │  Response Builder   │ ← 构建用户可见响应      │
│  │  (响应构建器)        │   - 结构化展示          │
│  └────────┬────────────┘   - 操作建议            │
│           ↓                                         │
│  User sees: 大纲/草稿/修改建议                      │
│  User action: 确认 / 修改指令 / 拒绝                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Internal Step Flow (Hidden from User)

```
Step 1: Generate Outline
    ↓ (save to ScriptMemory)
    ↓ (show to user)
User: Confirm / Revise
    ↓
Step 2: Generate Draft (based on confirmed outline)
    ↓ (save to ScriptMemory)
    ↓ (show to user)
User: Accept / Revise instruction
    ↓
Step 3: Auto-Critique (internal, user doesn't see)
    ↓ (if score < threshold, auto-revise)
    ↓
Step 4: Show Final Draft
    ↓
User: Accept → Save to Script table
        → Sync memories to Project Memory System
```

---

## Memory Architecture

### Script-Level Memory (Independent)

每个 Script 有独立的记忆空间，与 Project 的 Memory System **物理隔离**：

```prisma
model ScriptMemoryItem {
  id          String   @id @default(cuid())
  scriptId    String
  script      Script   @relation(fields: [scriptId], references: [id], onDelete: Cascade)

  // 分类（与 MemorySystem 对齐）
  type        MemoryType  // CHARACTER, LOCATION, EVENT, PLOT_POINT, FORESHADOWING, RELATIONSHIP

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
```

### Memory Sync Flow (Script → Project)

```
Script 定稿 / 立项
    ↓
Agent 触发同步
    ↓
For each ScriptMemoryItem:
    → Create/update corresponding MemoryItem in Project
    → Set episodeId if applicable
    → Preserve importance, tags, metadata
    ↓
Log sync result
```

**Sync Logic:**

```typescript
async function syncScriptMemoriesToProject(scriptId: string, projectId: string) {
  const scriptMemories = await scriptMemoryRepository.findByScript(scriptId)

  for (const sm of scriptMemories) {
    // Check if memory already exists (by type + title)
    const existing = await memoryRepository.findByProjectAndTitle(projectId, sm.type, sm.title)

    if (existing) {
      // Update existing
      await memoryRepository.update(existing.id, {
        content: sm.content,
        metadata: sm.metadata,
        tags: sm.tags,
        importance: sm.importance
      })
    } else {
      // Create new
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
}
```

---

## Agent Implementation

### Core Interface

```typescript
interface WritingStudioAgent {
  // 主入口：处理用户指令
  processUserCommand(input: UserInput): Promise<AgentResponse>

  // 步骤执行
  generateOutline(context: WritingContext): Promise<OutlineResult>
  generateDraft(context: WritingContext & { outline: OutlineResult }): Promise<DraftResult>
  critiqueAndRevise(draft: ScriptContent): Promise<RevisionResult>

  // 记忆管理
  loadScriptMemories(scriptId: string): Promise<ScriptMemory[]>
  saveScriptMemories(scriptId: string, memories: ScriptMemory[]): Promise<void>
  syncMemoriesToProject(scriptId: string, projectId: string): Promise<void>
}
```

### User Input & Response Types

```typescript
interface UserInput {
  scriptId: string
  command: string // 用户输入的指令，如"写一个穿越剧，主角回到明朝"
  context?: {
    selectedText?: string // 用户选中的文本
    targetEpisode?: number // 目标集数（如果指定）
  }
}

interface AgentResponse {
  type: 'outline' | 'draft' | 'revision' | 'suggestion' | 'error'
  content: string | ScriptContent | OutlineOutput
  metadata: {
    step: number
    totalSteps: number
    requiresUserAction: boolean
    actionLabel: string // "确认大纲" / "审核草稿" / "查看修改建议"
  }
  memories: ScriptMemory[] // 本次生成的记忆
}
```

### Intent Parser

```typescript
interface ParsedIntent {
  action: 'generate_new' | 'revise_existing' | 'continue_writing' | 'expand_scene'
  parameters: {
    genre?: string // 类型：穿越、悬疑、爱情...
    theme?: string // 主题
    characters?: string[] // 提到的角色
    setting?: string // 背景设定
    episodeCount?: number // 集数
    tone?: string // 语气/风格
  }
  rawCommand: string
}

class IntentParser {
  async parse(command: string): Promise<ParsedIntent> {
    // Use LLM to parse intent
    const prompt = `
      分析以下用户指令，提取意图和参数：

      用户指令：${command}

      返回 JSON：
      {
        "action": "generate_new" | "revise_existing" | "continue_writing" | "expand_scene",
        "parameters": {
          "genre": "...",
          "theme": "...",
          "characters": [...],
          "setting": "...",
          "episodeCount": N,
          "tone": "..."
        }
      }
    `

    const result = await callLLM(prompt)
    return JSON.parse(result)
  }
}
```

### Context Loader

```typescript
interface WritingContext {
  // 剧本记忆
  scriptMemories: ScriptMemory[]

  // 项目记忆（如果 script 关联了 project）
  projectMemories?: MemoryItem[]
  projectSettings?: {
    title: string
    synopsis: string
    style: string
    characters: Character[]
    locations: Location[]
  }

  // 前情摘要
  previousEpisodes?: {
    episodeNum: number
    synopsis: string
  }[]

  // 用户选中内容
  selectedText?: string

  // 当前剧本内容
  currentScript?: ScriptContent
}

class ContextLoader {
  async load(scriptId: string): Promise<WritingContext> {
    const script = await scriptRepository.findById(scriptId)

    // 1. Load script-level memories
    const scriptMemories = await scriptMemoryRepository.findByScript(scriptId)

    // 2. If script has projectId, load project memories
    let projectMemories: MemoryItem[] | undefined
    let projectSettings: any | undefined
    if (script.projectId) {
      projectMemories = await memoryRepository.findByProject(script.projectId)
      projectSettings = await projectRepository.findById(script.projectId)
    }

    // 3. Load previous episodes (if project exists)
    let previousEpisodes: any[] | undefined
    if (script.projectId) {
      previousEpisodes = await episodeRepository.findSynopsisByProject(
        script.projectId,
        script.targetEpisode || 1
      )
    }

    return {
      scriptMemories,
      projectMemories,
      projectSettings,
      previousEpisodes,
      selectedText: undefined, // Will be set from user input
      currentScript: script.content ? parseScriptContent(script.content) : undefined
    }
  }
}
```

### Step Executor

#### Step 1: Generate Outline

```typescript
async function generateOutline(
  context: WritingContext,
  intent: ParsedIntent
): Promise<OutlineResult> {
  const prompt = buildOutlinePrompt(context, intent)

  const result = await callLLMWithRetry({
    prompt,
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 4000
  })

  const outline = parseOutlineFromLLM(result.content)

  // Save outline to script memories
  const memories = extractMemoriesFromOutline(outline)
  await scriptMemoryRepository.bulkCreate(memories)

  return {
    outline,
    memories,
    metadata: {
      step: 1,
      totalSteps: 3,
      requiresUserAction: true,
      actionLabel: '确认大纲'
    }
  }
}

function buildOutlinePrompt(context: WritingContext, intent: ParsedIntent): string {
  let prompt = `你是一个专业的短剧编剧。请根据用户要求创作剧本大纲。

用户要求：${intent.rawCommand}

`

  // Add context
  if (context.projectSettings) {
    prompt += `
项目信息：
- 剧名：${context.projectSettings.title}
- 梗概：${context.projectSettings.synopsis}
- 风格：${context.projectSettings.style}
`
  }

  if (context.previousEpisodes && context.previousEpisodes.length > 0) {
    prompt += `
前情摘要：
${context.previousEpisodes.map((ep) => `第${ep.episodeNum}集：${ep.synopsis}`).join('\n')}
`
  }

  if (context.scriptMemories.length > 0) {
    prompt += `
已有记忆：
${context.scriptMemories.map((m) => `- [${m.type}] ${m.title}: ${m.content}`).join('\n')}
`
  }

  prompt += `
请返回以下 JSON 格式的大纲：
{
  "title": "剧本标题",
  "synopsis": "全剧梗概（200字以内）",
  "episodes": [
    {
      "episodeNum": 1,
      "title": "第X集标题",
      "synopsis": "本集梗概（100-200字）",
      "keyScenes": ["场景1简述", "场景2简述"],
      "characters": ["角色A", "角色B"]
    }
  ],
  "mainCharacters": [
    {
      "name": "角色名",
      "description": "角色简介",
      "arc": "角色弧光/成长线"
    }
  ]
}

只返回 JSON，不要其他内容。`

  return prompt
}
```

#### Step 2: Generate Draft

```typescript
async function generateDraft(
  context: WritingContext,
  outline: OutlineResult
): Promise<DraftResult> {
  // Generate episode by episode (or all at once based on user preference)
  const episodes = outline.outline.episodes.map(async (ep) => {
    const prompt = buildDraftPrompt(context, outline.outline, ep)
    const result = await callLLMWithRetry({
      prompt,
      model: 'deepseek-chat',
      temperature: 0.8,
      maxTokens: 8000
    })
    return parseScriptFromLLM(result.content)
  })

  const scripts = await Promise.all(episodes)

  // Save draft memories
  const memories = extractMemoriesFromDrafts(scripts)
  await scriptMemoryRepository.bulkCreate(memories)

  return {
    scripts,
    memories,
    metadata: {
      step: 2,
      totalSteps: 3,
      requiresUserAction: true,
      actionLabel: '审核草稿'
    }
  }
}
```

#### Step 3: Auto-Critique & Revise

```typescript
async function critiqueAndRevise(draft: ScriptContent): Promise<RevisionResult> {
  // Internal critique (user doesn't see this step)
  const critique = await criticAgent.evaluate(draft)

  if (critique.pass) {
    // Score >= threshold, no revision needed
    return {
      script: draft,
      revisionCount: 0,
      critiqueScore: critique.overallScore,
      metadata: {
        step: 3,
        totalSteps: 3,
        requiresUserAction: true,
        actionLabel: '查看最终稿'
      }
    }
  }

  // Auto-revise based on critique
  const revisionPrompt = `
    请根据以下审核意见修改剧本：

    原始剧本：
    ${JSON.stringify(draft)}

    审核意见：
    ${critique.actionableFeedback.join('\n')}

    请只返回修改后的完整 JSON 剧本。
  `

  const result = await callLLMWithRetry({
    prompt: revisionPrompt,
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 8000
  })

  return {
    script: parseScriptFromLLM(result.content),
    revisionCount: 1,
    critiqueScore: critique.overallScore,
    feedback: critique.actionableFeedback,
    metadata: {
      step: 3,
      totalSteps: 3,
      requiresUserAction: true,
      actionLabel: '查看最终稿'
    }
  }
}
```

---

## User Interaction Flow

### Scenario 1: Generate New Script

```
User types: "写一个穿越剧，主角是现代人回到明朝当科学家"
     ↓
Agent parses intent:
  - action: generate_new
  - genre: 穿越
  - setting: 明朝
  - main_character: 现代科学家
     ↓
Agent loads context:
  - No existing memories (new script)
  - User may have project context
     ↓
Agent generates outline → Shows to user in right panel:

┌─────────────────────────────────────┐
│  AI 编剧 - 大纲生成完成              │
├─────────────────────────────────────┤
│  剧名：回到明朝当科学家              │
│  集数：5 集                          │
│                                      │
│  第1集：穿越                         │
│  现代科学家李明意外穿越到明朝...     │
│                                      │
│  第2集：初到明朝                     │
│  李明发现自己在太医院...             │
│                                      │
│  ...                                 │
│                                      │
│  [✅ 确认大纲] [✏️ 修改指令]          │
└─────────────────────────────────────┘

User clicks: "✅ 确认大纲"
     ↓
Agent generates draft → Shows in editor (left panel):

┌─────────────────────────────────────┐
│  AI 编剧 - 草稿生成完成              │
├─────────────────────────────────────┤
│  Scene 1. 现代实验室 - 夜           │
│  李明正在做实验，突然雷声大作...     │
│                                      │
│  Scene 2. 明朝太医院 - 日           │
│  李明醒来，发现自己身处古殿...      │
│                                      │
│  [✅ 接受] [✏️ 输入修改指令]          │
└─────────────────────────────────────┘

User clicks: "✅ 接受"
     ↓
Agent auto-critiques & revises internally
     ↓
Agent shows final result → User accepts
     ↓
Script saved to database
Memories synced to ScriptMemory table
     ↓
If script is linked to project:
  → Memories synced to Project Memory System
```

### Scenario 2: Revise Existing Script

```
User selects text in editor, types: "让这段对话更紧张一些"
     ↓
Agent parses intent:
  - action: revise_existing
  - selectedText: "宋应星：这是哪里？\n..."
     ↓
Agent loads context:
  - Script memories
  - Selected text
  - Current full script
     ↓
Agent revises only selected portion
     ↓
Shows diff modal (current vs revised):

┌─────────────────────────────────────┐
│  差异对比                            │
├──────────────┬──────────────────────┤
│  原文        │  修改后               │
├──────────────┼──────────────────────┤
│ 宋应星：     │ 宋应星（急促地）：     │
│ 这是哪里？   │ 这是哪里？！           │
│              │ 四周为何如此陌生！     │
└──────────────┴──────────────────────┘
│                                      │
│  [✅ 接受修改] [❌ 保留原文]           │
└─────────────────────────────────────┘
```

---

## Database Schema Changes

### New Tables

```prisma
// Script 表扩展（已有，需添加字段）
model Script {
  // ... existing fields ...

  // 新增：目标集数（用于生成时指定）
  targetEpisode  Int?

  // 新增：当前生成状态
  generationStatus Json?  // { step: number, outline: ..., draft: ..., ... }

  // 新增：关联的记忆
  memories     ScriptMemoryItem[]
}

// 剧本独立记忆表（新增）
model ScriptMemoryItem {
  id          String   @id @default(cuid())
  scriptId    String
  script      Script   @relation(fields: [scriptId], references: [id], onDelete: Cascade)

  type        MemoryType
  category    String?
  title       String
  content     String   @db.Text
  metadata    Json?

  tags        String[] @default([])
  importance  Int      @default(3)
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([scriptId, type])
  @@index([scriptId, isActive])
}

// MemoryType 枚举（复用现有）
enum MemoryType {
  CHARACTER
  LOCATION
  EVENT
  PLOT_POINT
  FORESHADOWING
  RELATIONSHIP
  VISUAL_STYLE
}
```

---

## API Endpoints

### Existing (Keep)

```
GET    /api/scripts/latest      - 获取最新草稿
PUT    /api/scripts/:id         - 更新剧本
```

### New Endpoints

```
POST   /api/scripts/:id/agent   - Agent 主入口
Request: {
  command: string,
  context?: {
    selectedText?: string,
    targetEpisode?: number
  }
}
Response: {
  type: 'outline' | 'draft' | 'revision',
  content: ...,
  metadata: { step, totalSteps, requiresUserAction, actionLabel },
  memories: [...]
}

POST   /api/scripts/:id/agent/confirm  - 确认当前步骤
Request: {
  action: 'confirm' | 'revise',
  revisionInstruction?: string  // 如果 action = 'revise'
}
Response: {
  type: 'draft' | 'final',
  content: ...,
  metadata: ...
}

POST   /api/scripts/:id/agent/memories/sync  - 同步记忆到项目
Request: { projectId: string }
Response: { synced: number }

GET    /api/scripts/:id/memories  - 获取剧本记忆
Response: ScriptMemoryItem[]
```

---

## Frontend Changes

### Studio.vue Modifications

```vue
<!-- Add Agent interaction panel -->
<div class="ai-panel">
  <!-- Existing ChatPanel -->
  <ChatPanel
    v-if="!agentMode"
    :script-id="script?.id"
    :script-content="content"
    @apply-changes="handleApplyChanges"
  />

  <!-- New Agent Panel -->
  <AgentPanel
    v-else
    :script-id="script?.id"
    :agent-state="agentState"
    @command="handleAgentCommand"
    @confirm="handleAgentConfirm"
    @revise="handleAgentRevise"
  />
</div>

<!-- Agent state in component -->
const agentMode = ref(false) const agentState = ref<{ step: number totalSteps: number
currentContent: string | null requiresAction: boolean actionLabel: string }>({ step: 0, totalSteps:
3, currentContent: null, requiresAction: false, actionLabel: '' })
```

### AgentPanel Component

```vue
<template>
  <div class="agent-panel">
    <!-- Agent status indicator -->
    <div class="agent-status">
      <NProgress :percentage="(state.step / state.totalSteps) * 100" />
      <p>{{ statusText }}</p>
    </div>

    <!-- Step content -->
    <div v-if="state.currentContent" class="step-content">
      <div v-html="renderedContent"></div>
    </div>

    <!-- Action buttons -->
    <div v-if="state.requiresAction" class="action-buttons">
      <NButton type="primary" @click="handleConfirm">
        {{ state.actionLabel }}
      </NButton>
      <NButton @click="showRevisionInput = true"> ✏️ 修改指令 </NButton>
    </div>

    <!-- Revision input -->
    <div v-if="showRevisionInput" class="revision-input">
      <NInput
        v-model:value="revisionInstruction"
        placeholder="输入修改指令..."
        @keyup.enter="handleRevise"
      />
      <NButton @click="handleRevise">执行修改</NButton>
    </div>
  </div>
</template>
```

---

## Implementation Phases

### Phase 1: Foundation (1-2 days)

**Database:**

- [ ] Add `ScriptMemoryItem` model to `schema.prisma`
- [ ] Add `targetEpisode` and `generationStatus` fields to `Script` model
- [ ] Run `pnpm db:push`

**Backend:**

- [ ] Create `packages/backend/src/services/agents/writing-studio-agent.ts`
- [ ] Implement `IntentParser`
- [ ] Implement `ContextLoader`
- [ ] Create `packages/backend/src/routes/script-agent.ts`
- [ ] Add `POST /api/scripts/:id/agent` endpoint

**Frontend:**

- [ ] Create `packages/frontend/src/components/AgentPanel.vue`
- [ ] Modify `Studio.vue` to toggle between `ChatPanel` and `AgentPanel`

### Phase 2: Core Pipeline (2-3 days)

**Backend:**

- [ ] Implement `generateOutline()` step
- [ ] Implement `generateDraft()` step
- [ ] Implement `critiqueAndRevise()` step
- [ ] Add memory extraction from outline/draft
- [ ] Add `POST /api/scripts/:id/agent/confirm` endpoint

**Frontend:**

- [ ] Implement agent state machine in `Studio.vue`
- [ ] Add outline preview in `AgentPanel`
- [ ] Add draft review with accept/revise buttons

### Phase 3: Memory Sync (1-2 days)

**Backend:**

- [ ] Implement `syncScriptMemoriesToProject()` function
- [ ] Add `POST /api/scripts/:id/agent/memories/sync` endpoint
- [ ] Add `GET /api/scripts/:id/memories` endpoint
- [ ] Add memory sync trigger on script publish/project link

**Frontend:**

- [ ] Add memory viewer in `AgentPanel`
- [ ] Add sync confirmation dialog

### Phase 4: Polish & Testing (1-2 days)

**Testing:**

- [ ] Write unit tests for `IntentParser`
- [ ] Write unit tests for `ContextLoader`
- [ ] Write integration tests for full agent flow
- [ ] Write tests for memory sync

**Polish:**

- [ ] Add loading animations
- [ ] Add error handling and retry
- [ ] Add agent cost tracking
- [ ] Add agent usage history

---

## Key Design Decisions

### Decision 1: Script-Level Memory (Not Project-Level)

**Why:**

- Script is a **draft workspace** - messy, iterative, experimental
- Project memory should be **curated** - only finalized, validated content
- Allows users to experiment without polluting project memory
- Clean separation: draft vs. production

**Sync Trigger:**

- User clicks "立项" (create project from script)
- User marks script as "READY" status
- Manual sync button in Agent panel

### Decision 2: Step-by-Step (Not Fully Auto)

**Why:**

- User wants **control** over creative process
- Outline approval prevents wasted LLM calls on wrong direction
- Each step is a **checkpoint** - user can revise before proceeding
- More transparent than black-box auto-generation

**Trade-off:**

- Slower than fully auto, but higher quality output
- User can skip steps if confident (future enhancement)

### Decision 3: Dialog-Based Interaction (Not Form)

**Why:**

- Matches existing Studio UX pattern
- More flexible than rigid forms
- Users can express complex requirements in natural language
- LLM intent parser handles ambiguity well

**Enhancement:**

- Agent can **suggest** parameters after parsing (e.g., "我理解你想写一个 5 集穿越剧，对吗？")
- User can confirm/correct before generation starts

---

## Success Metrics

| Metric                       | Target                                                 |
| ---------------------------- | ------------------------------------------------------ |
| Agent usage rate             | > 50% of Studio sessions use Agent vs. manual commands |
| Outline approval rate        | > 80% approved on first try (minor revisions ok)       |
| Draft acceptance rate        | > 70% accepted after auto-revision                     |
| Average revisions per script | < 2 (including auto-revision)                          |
| User satisfaction            | > 4/5 stars in post-generation feedback                |

---

## Risks & Mitigations

### Risk 1: LLM Output Quality

**Mitigation:**

- Critic agent auto-revises before showing to user
- User can always revise manually
- Track critique scores to identify weak prompts

### Risk 2: Context Window Overflow

**Mitigation:**

- Use Memory System's `buildEpisodeWritingContext` (already compresses)
- Generate episodes sequentially (not all at once)
- Fallback to summarization if context too large

### Risk 3: Memory Sync Conflicts

**Mitigation:**

- Sync is idempotent (upsert by type + title)
- Log all sync operations
- User can manually review/edit memories before sync

### Risk 4: Cost Explosion

**Mitigation:**

- Track all LLM calls via existing `ModelApiCall`
- Show estimated cost before generation
- Set per-script budget limit (future enhancement)

---

## Next Steps

1. **Review this design** - Confirm architecture and approach
2. **Start Phase 1** - Database schema + IntentParser + ContextLoader
3. **Build AgentPanel** - Frontend component for agent interaction
4. **Implement pipeline** - Outline → Draft → Critique steps
5. **Test end-to-end** - Full flow from user command to saved script
