/**
 * Agent 类型定义
 * AI Writing Studio Agent 的核心数据结构
 */

// 意图解析结果
export interface ParsedIntent {
  action: 'generate_new' | 'revise_existing' | 'continue_writing' | 'expand_scene'
  parameters: {
    genre?: string
    theme?: string
    characters?: string[]
    setting?: string
    episodeCount?: number
    tone?: string
    targetLength?: 'short' | 'medium' | 'long'
  }
  rawCommand: string
  confidence: number // 0-1，LLM 对解析结果的置信度
}

// 写作上下文（由 ContextLoader 构建）
export interface WritingContext {
  scriptMemories: ScriptMemoryItem[]
  projectMemories?: ProjectMemoryItem[]
  projectSettings?: {
    title: string
    synopsis: string
    style: string
    characters: Array<{ name: string; description: string }>
    locations: Array<{ name: string; description: string }>
  }
  previousEpisodes?: Array<{ episodeNum: number; synopsis: string }>
  selectedText?: string
  currentScript?: {
    id: string
    content: string
    title: string
  }
}

// 简化的 ScriptMemoryItem 类型（避免循环依赖）
export interface ScriptMemoryItem {
  id: string
  scriptId: string
  type: string
  category: string | null
  title: string
  content: string
  metadata: Record<string, unknown> | null
  tags: string[]
  importance: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// 简化的 ProjectMemoryItem 类型
export interface ProjectMemoryItem {
  id: string
  projectId: string
  type: string
  category: string | null
  title: string
  content: string
  metadata: Record<string, unknown> | null
  tags: string[]
  importance: number
  isActive: boolean
}

// Agent 响应
export interface AgentResponse {
  type: 'intent_confirm' | 'outline' | 'draft' | 'revision' | 'error' | 'complete'
  content: string | ScriptContent | OutlineOutput
  metadata: {
    step: number
    totalSteps: number
    requiresUserAction: boolean
    actionLabel: string // "确认大纲" / "审核草稿" / ...
  }
  memories?: ScriptMemoryItem[]
}

// 大纲输出
export interface OutlineOutput {
  title: string
  episodeCount: number
  episodes: Array<{
    episodeNum: number
    title: string
    synopsis: string
    keyScenes: string[]
  }>
}

// 剧本内容
export interface ScriptContent {
  title: string
  content: string
  scenes: Array<{
    sceneNum: number
    location: string
    timeOfDay: string
    description: string
    dialogues: Array<{
      character: string
      text: string
    }>
  }>
}

// Agent 会话状态（用于确认端点）
export interface AgentSession {
  scriptId: string
  currentStep:
    | 'idle'
    | 'intent_parsed'
    | 'context_loaded'
    | 'outline_generated'
    | 'draft_generated'
    | 'complete'
  intent: ParsedIntent | null
  context: WritingContext | null
  outline: OutlineOutput | null
  draft: ScriptContent | null
  memories: ScriptMemoryItem[]
  lastResponse: AgentResponse | null
}

// Harness Checkpoint 状态
export interface AgentCheckpointState {
  currentStep: string
  intent: ParsedIntent | null
  context: WritingContext | null
  outline: OutlineOutput | null
  draft: ScriptContent | null
  critiqueScore: number | null
  version: number
}

// 确认请求
export interface ConfirmRequest {
  action: 'confirm' | 'revise'
  revisionInstruction?: string
}

// Agent 流式事件类型

/** Agent 步骤标识 */
export type AgentStep =
  | 'intent_parsing'
  | 'context_loading'
  | 'outline_generation'
  | 'draft_generation'
  | 'critique'
  | 'revision'
  | 'memory_extraction'
  | 'complete'

/** 流式事件基础接口 */
export interface AgentStreamEventBase {
  /** 当前步骤 */
  step: AgentStep
  /** 步骤编号（1-based） */
  stepNumber: number
  /** 总步骤数 */
  totalSteps: number
}

/** 步骤开始事件 */
export interface AgentStepStartEvent extends AgentStreamEventBase {
  type: 'step_start'
  /** 人类可读的步骤名称 */
  stepLabel: string
  /** 此步骤是否产生可流式输出的文本 */
  isStreaming: boolean
}

/** Token 事件（仅文本类 Agent） */
export interface AgentTokenEvent extends AgentStreamEventBase {
  type: 'token'
  /** 增量内容 */
  content: string
}

/** 步骤完成事件 */
export interface AgentStepCompleteEvent extends AgentStreamEventBase {
  type: 'step_complete'
  /** 步骤结果 */
  result: {
    type: 'intent_confirm' | 'outline' | 'draft' | 'critique' | 'revision' | 'complete'
    content: string | ParsedIntent | OutlineOutput | ScriptContent
    summary: string
  }
  /** 是否需要用户操作 */
  requiresUserAction: boolean
  /** 操作按钮标签 */
  actionLabel?: string
}

/** 错误事件 */
export interface AgentErrorEvent extends AgentStreamEventBase {
  type: 'error'
  /** 错误信息 */
  message: string
  /** 是否可恢复 */
  recoverable: boolean
}

/** 完成事件 */
export interface AgentDoneEvent extends AgentStreamEventBase {
  type: 'done'
  /** 最终剧本内容 */
  content: string
  /** 提取的记忆 */
  memories: ScriptMemoryItem[]
}

/** 所有流式事件的联合类型 */
export type AgentStreamEvent =
  | AgentStepStartEvent
  | AgentTokenEvent
  | AgentStepCompleteEvent
  | AgentErrorEvent
  | AgentDoneEvent
