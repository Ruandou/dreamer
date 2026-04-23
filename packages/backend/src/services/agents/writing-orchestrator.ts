/**
 * 写作流水线协调器
 * 协调整个写作流程：意图解析 → 大纲 → 草稿 → 审核 → 修改
 */

import { prisma } from '../../lib/prisma.js'
import type { Prisma } from '@prisma/client'
import { intentParser } from './intent-parser.js'
import { contextLoader } from './context-loader.js'
import { outlineAgent } from './outline-agent.js'
import { draftAgent } from './draft-agent.js'
import { criticAgent, type CritiqueResult } from './critic-agent.js'
import { revisionAgent } from './revision-agent.js'
import { memoryExtractor } from './memory-extractor.js'
import type {
  ParsedIntent,
  WritingContext,
  OutlineOutput,
  ScriptContent,
  AgentResponse,
  ScriptMemoryItem,
  AgentStreamEvent
} from './types.js'

export interface OrchestratorState {
  scriptId: string
  userId: string
  currentStep:
    | 'idle'
    | 'intent_parsed'
    | 'outline_generated'
    | 'draft_generated'
    | 'critiqued'
    | 'revised'
    | 'complete'
  intent: ParsedIntent | null
  context: WritingContext | null
  outline: OutlineOutput | null
  draft: ScriptContent | null
  critique: CritiqueResult | null
  memories: ScriptMemoryItem[]
}

const CRITIQUE_THRESHOLD = 75 // 审核通过阈值
const MAX_REVISION_ROUNDS = 3 // 最大修改轮数

export class WritingOrchestrator {
  private state: OrchestratorState

  constructor(scriptId: string, userId: string) {
    this.state = {
      scriptId,
      userId,
      currentStep: 'idle',
      intent: null,
      context: null,
      outline: null,
      draft: null,
      critique: null,
      memories: []
    }
  }

  /**
   * 获取当前状态
   */
  getState(): OrchestratorState {
    return { ...this.state }
  }

  /**
   * 步骤 1: 解析用户意图
   */
  async parseIntent(command: string): Promise<AgentResponse> {
    // 加载上下文
    const context = await contextLoader.loadContext(this.state.scriptId, {
      includeProjectMemories: true
    })
    this.state.context = context

    // 解析意图
    const intent = await intentParser.parse(command, context)
    this.state.intent = intent
    this.state.currentStep = 'intent_parsed'

    // 构建确认响应
    const params = intent.parameters
    const summary =
      [
        params.genre && `类型：${params.genre}`,
        params.theme && `主题：${params.theme}`,
        params.characters &&
          params.characters.length > 0 &&
          `角色：${params.characters.join('、')}`,
        params.setting && `背景：${params.setting}`,
        params.episodeCount && `集数：${params.episodeCount}`,
        params.tone && `基调：${params.tone}`
      ]
        .filter(Boolean)
        .join('\n') || intent.rawCommand

    return {
      type: 'intent_confirm',
      content: `我理解你想创作：\n\n${summary}\n\n请问这个理解正确吗？确认后我将开始生成大纲。`,
      metadata: {
        step: 1,
        totalSteps: 5,
        requiresUserAction: true,
        actionLabel: '确认意图'
      }
    }
  }

  /**
   * 步骤 2: 生成大纲
   */
  async generateOutline(): Promise<AgentResponse> {
    if (!this.state.intent || !this.state.context) {
      throw new Error('请先解析意图')
    }

    // 生成大纲
    const outline = await outlineAgent.generate(
      this.state.userId,
      this.state.intent,
      this.state.context
    )
    this.state.outline = outline
    this.state.currentStep = 'outline_generated'

    // 提取大纲记忆
    const memories = await memoryExtractor.extractFromOutline(
      this.state.userId,
      this.state.scriptId,
      outline
    )
    this.state.memories = memories

    // 构建大纲展示
    const outlineText = outline.episodes
      .map((ep) => `第${ep.episodeNum}集：${ep.title}\n${ep.synopsis}`)
      .join('\n\n')

    return {
      type: 'outline',
      content: `✅ 大纲已生成（共 ${outline.episodeCount} 集）：\n\n${outlineText}\n\n请确认后继续生成草稿。`,
      metadata: {
        step: 2,
        totalSteps: 5,
        requiresUserAction: true,
        actionLabel: '确认大纲'
      },
      memories
    }
  }

  /**
   * 步骤 3-5: 生成草稿 + 审核 + 修改（内部流水线，用户不可见）
   */
  async generateDraftWithCritique(targetEpisode?: number): Promise<AgentResponse> {
    if (!this.state.outline) {
      throw new Error('请先生成大纲')
    }

    if (!this.state.context) {
      throw new Error('上下文未加载')
    }

    let revisionCount = 0

    // 生成草稿
    const draft = await draftAgent.generate(
      this.state.userId,
      this.state.outline,
      this.state.context,
      targetEpisode
    )
    this.state.draft = draft

    // 审核循环
    let critique: CritiqueResult
    do {
      // 审核
      critique = await criticAgent.critique(this.state.userId, draft, this.state.outline)
      this.state.critique = critique
      this.state.currentStep = 'critiqued'

      // 如果评分低于阈值，自动修改
      if (critique.overallScore < CRITIQUE_THRESHOLD && revisionCount < MAX_REVISION_ROUNDS) {
        const revisedDraft = await revisionAgent.revise(this.state.userId, draft, critique)
        this.state.draft = revisedDraft
        revisionCount++
        this.state.currentStep = 'revised'
      } else {
        break
      }
    } while (revisionCount < MAX_REVISION_ROUNDS)

    // 提取草稿记忆
    const newMemories = await memoryExtractor.extractFromDraft(
      this.state.userId,
      this.state.scriptId,
      draft
    )
    this.state.memories = [...this.state.memories, ...newMemories]

    // 保存到数据库
    await this.saveDraft(draft)

    // 构建响应
    let responseContent = `✅ 草稿已生成`
    if (revisionCount > 0) {
      responseContent += `（经过 ${revisionCount} 轮自动修改）`
    }
    responseContent += `\n\n总体评分：${critique.overallScore}/100`
    responseContent += `\n\n优点：${critique.strengths}`
    responseContent += `\n\n请审核草稿，接受或提出修改意见。`

    return {
      type: 'draft',
      content: responseContent,
      metadata: {
        step: 3,
        totalSteps: 5,
        requiresUserAction: true,
        actionLabel: '接受草稿'
      },
      memories: this.state.memories
    }
  }

  /**
   * 用户确认接受草稿
   */
  async acceptDraft(): Promise<AgentResponse> {
    this.state.currentStep = 'complete'

    return {
      type: 'complete',
      content: '✅ 剧本已保存！你可以在左侧编辑器中查看和继续编辑。\n\n是否同步到项目记忆？',
      metadata: {
        step: 5,
        totalSteps: 5,
        requiresUserAction: false,
        actionLabel: ''
      },
      memories: this.state.memories
    }
  }

  /**
   * 用户提出修改意见
   */
  async reviseDraft(instruction: string): Promise<AgentResponse> {
    if (!this.state.draft) {
      throw new Error('草稿未生成')
    }

    // 使用 RevisionAgent 修改
    const critique: CritiqueResult = {
      scores: {
        coherence: 70,
        characterConsistency: 70,
        sceneQuality: 70,
        dramaticConflict: 70,
        format: 70
      },
      overallScore: 70,
      feedback: instruction,
      strengths: '',
      weaknesses: ''
    }

    const revisedDraft = await revisionAgent.revise(this.state.userId, this.state.draft, critique)
    this.state.draft = revisedDraft

    // 保存
    await this.saveDraft(revisedDraft)

    return {
      type: 'revision',
      content: '✅ 草稿已根据你的意见修改，请查看左侧编辑器。',
      metadata: {
        step: 4,
        totalSteps: 5,
        requiresUserAction: false,
        actionLabel: ''
      }
    }
  }

  /**
   * 保存草稿到数据库
   */
  private async saveDraft(draft: ScriptContent): Promise<void> {
    await prisma.script.update({
      where: { id: this.state.scriptId },
      data: {
        content: draft.content,
        title: draft.title,
        generationStatus: JSON.parse(
          JSON.stringify({
            step: this.state.currentStep,
            outline: this.state.outline,
            draft: { title: draft.title, contentLength: draft.content.length },
            memories: this.state.memories.length,
            updatedAt: new Date().toISOString()
          })
        ) as Prisma.InputJsonValue
      }
    })
  }

  /**
   * 流式执行整个写作流程
   */
  async *executeStream(command: string): AsyncGenerator<AgentStreamEvent> {
    // 步骤 1: 加载上下文
    yield {
      type: 'step_start',
      step: 'context_loading',
      stepNumber: 1,
      totalSteps: 5,
      stepLabel: '加载上下文',
      isStreaming: false
    }

    const context = await contextLoader.loadContext(this.state.scriptId, {
      includeProjectMemories: true
    })
    this.state.context = context

    yield {
      type: 'step_complete',
      step: 'context_loading',
      stepNumber: 1,
      totalSteps: 5,
      result: {
        type: 'intent_confirm',
        content: '上下文已加载',
        summary: ''
      },
      requiresUserAction: false,
      actionLabel: ''
    }

    // 步骤 2: 解析意图
    let intentConfirmed = false
    for await (const event of intentParser.parseStream(command, this.state.context)) {
      yield event
      if (event.type === 'step_complete') {
        this.state.intent = event.result.content as ParsedIntent
        this.state.currentStep = 'intent_parsed'
        // Check if user confirmation is required
        if ('requiresUserAction' in event && event.requiresUserAction) {
          intentConfirmed = true
        }
      }
    }

    // Stop here and wait for user confirmation before generating outline
    if (intentConfirmed) {
      return
    }

    // 步骤 3: 生成大纲 (only after user confirms via continueStream)
    if (!this.state.intent) {
      throw new Error('意图未解析')
    }

    for await (const event of outlineAgent.generateStream(
      this.state.userId,
      this.state.intent,
      this.state.context
    )) {
      yield event
      if (event.type === 'step_complete') {
        this.state.outline = event.result.content as OutlineOutput
        this.state.currentStep = 'outline_generated'

        // 提取大纲记忆
        const memories = await memoryExtractor.extractFromOutline(
          this.state.userId,
          this.state.scriptId,
          this.state.outline
        )
        this.state.memories = memories
      }
    }
  }

  /**
   * 流式继续：根据当前状态继续执行
   * - intent_parsed → 生成大纲 → 生成草稿 + 审核 + 修改
   * - outline_generated → 生成草稿 + 审核 + 修改
   */
  async *continueStream(targetEpisode?: number): AsyncGenerator<AgentStreamEvent> {
    // 如果还在意图解析阶段，先生成大纲
    if (this.state.currentStep === 'intent_parsed' && this.state.intent && this.state.context) {
      for await (const event of outlineAgent.generateStream(
        this.state.userId,
        this.state.intent,
        this.state.context
      )) {
        yield event
        if (event.type === 'step_complete') {
          this.state.outline = event.result.content as OutlineOutput
          this.state.currentStep = 'outline_generated'

          // 提取大纲记忆
          const memories = await memoryExtractor.extractFromOutline(
            this.state.userId,
            this.state.scriptId,
            this.state.outline
          )
          this.state.memories = memories
        }
      }
    }

    if (!this.state.outline || !this.state.context) {
      throw new Error('大纲或上下文未加载')
    }

    let revisionCount = 0
    let draft: ScriptContent | null = null

    // 生成草稿
    for await (const event of draftAgent.generateStream(
      this.state.userId,
      this.state.outline,
      this.state.context,
      targetEpisode
    )) {
      yield event
      if (event.type === 'step_complete') {
        draft = event.result.content as ScriptContent
        this.state.draft = draft
        this.state.currentStep = 'draft_generated'
      }
    }

    if (!draft) {
      throw new Error('草稿生成失败')
    }

    // 审核循环
    let critique: CritiqueResult
    do {
      for await (const event of criticAgent.critiqueStream(
        this.state.userId,
        draft,
        this.state.outline
      )) {
        yield event
        if (event.type === 'step_complete') {
          this.state.critique = JSON.parse(event.result.content as string) as CritiqueResult
          this.state.currentStep = 'critiqued'
        }
      }

      critique = this.state.critique ?? {
        overallScore: 0,
        scores: {
          coherence: 0,
          characterConsistency: 0,
          sceneQuality: 0,
          dramaticConflict: 0,
          format: 0
        },
        feedback: '',
        strengths: '',
        weaknesses: ''
      }

      if (critique.overallScore < 75 && revisionCount < 3) {
        for await (const event of revisionAgent.reviseStream(this.state.userId, draft, critique)) {
          yield event
          if (event.type === 'step_complete') {
            draft = event.result.content as ScriptContent
            this.state.draft = draft
            revisionCount++
            this.state.currentStep = 'revised'
          }
        }
      } else {
        break
      }
    } while (revisionCount < 3)

    // 提取草稿记忆
    const newMemories = await memoryExtractor.extractFromDraft(
      this.state.userId,
      this.state.scriptId,
      draft
    )
    this.state.memories = [...this.state.memories, ...newMemories]

    // 保存到数据库
    await this.saveDraft(draft)

    // 发送完成事件
    yield {
      type: 'done',
      step: 'complete',
      stepNumber: 5,
      totalSteps: 5,
      content: draft.content,
      memories: this.state.memories
    }
  }
}

// 创建协调器的工厂函数
export function createWritingOrchestrator(scriptId: string, userId: string): WritingOrchestrator {
  return new WritingOrchestrator(scriptId, userId)
}
