import { PromptRegistry } from "../prompts/registry.js";
import {
  getDefaultProvider,
  type LLMProvider,
} from "../ai/llm-factory.js";
import type { LLMMessage } from "../ai/llm-provider.js";
import {
  callLLMWithRetry,
  type LLMCallOptions,
} from "../ai/llm-call-wrapper.js";
import type { MemoryType } from "../../repositories/memory-repository.js";
import type { ScriptContent } from "@dreamer/shared/types";
import type { ModelCallLogContext } from "../ai/api-logger.js";

export interface ExtractedMemory {
  type: MemoryType;
  category?: string;
  title: string;
  content: string;
  tags: string[];
  importance: number;
  metadata?: Record<string, any>;
}

export interface MemoryExtractionResult {
  memories: ExtractedMemory[];
  cost: { costCNY: number };
}

/**
 * 从剧本中提取剧情记忆
 */
export async function extractMemoriesWithLLM(
  script: ScriptContent,
  episodeNum: number,
  existingMemories: string = "",
  modelLog?: ModelCallLogContext,
  provider?: LLMProvider,
): Promise<MemoryExtractionResult> {
  const llmProvider = provider || getDefaultProvider();
  const template = PromptRegistry.getInstance().getLatest("memory-extraction");

  const rendered = PromptRegistry.getInstance().render("memory-extraction", {
    variables: {
      episodeNum: String(episodeNum),
      script: JSON.stringify(script, null, 2),
      existingMemories: existingMemories || "",
    },
  });

  const messages: LLMMessage[] = [
    { role: "system", content: rendered.systemPrompt },
    { role: "user", content: rendered.userPrompt },
  ];

  const parseMemories = (content: string): MemoryExtractionResult => {
    // 清理 markdown 代码块
    const cleanContent = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleanContent);

    if (!parsed.memories || !Array.isArray(parsed.memories)) {
      throw new Error(
        "Invalid memory extraction response: missing memories array",
      );
    }

    const memories: ExtractedMemory[] = parsed.memories.map((m: any) => ({
      type: m.type as MemoryType,
      category: m.category,
      title: m.title,
      content: m.content,
      tags: m.tags || [],
      importance: m.importance || 3,
      metadata: m.metadata || {},
    }));

    return {
      memories,
      cost: { costCNY: 0 }, // Will be filled by callLLMWithRetry
    };
  };

  const options: LLMCallOptions = {
    provider: llmProvider,
    messages,
    temperature: template.metadata.creativity,
    maxTokens: template.metadata.maxOutputTokens,
    modelLog,
  };

  const result = await callLLMWithRetry(options, parseMemories);

  return {
    memories: result.content.memories,
    cost: result.cost,
  };
}

/**
 * 格式化已有记忆为字符串（用于提示词）
 */
export function formatExistingMemories(
  memories: Array<{
    type: string;
    title: string;
    content: string;
  }>,
): string {
  if (memories.length === 0) return "";

  return memories
    .map((m) => `- [${m.type}] ${m.title}: ${m.content}`)
    .join("\n");
}
