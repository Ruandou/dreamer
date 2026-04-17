/**
 * Memory module - 剧情记忆系统
 *
 * 提供结构化的剧情记忆管理，支持：
 * - 从剧本自动提取记忆（角色、场地、事件、伏笔等）
 * - 为剧本生成构建智能上下文
 * - 记忆查询、搜索、合并
 */

export { MemoryService, getMemoryService } from "./memory-service.js";
export { extractMemoriesWithLLM, formatExistingMemories } from "./extractor.js";
export {
  buildEpisodeWritingContext,
  buildStoryboardContext,
  formatMemoriesForPrompt,
} from "./context-builder.js";

export type { ExtractedMemory, MemoryExtractionResult } from "./extractor.js";
export type { EpisodeWritingContext } from "./context-builder.js";
