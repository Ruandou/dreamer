import { MemoryRepository } from "../../repositories/memory-repository.js";
import type { MemoryItem } from "@prisma/client";

export interface EpisodeWritingContext {
  characters: string;
  locations: string;
  recentEvents: string;
  activeForeshadowings: string;
  relationships: string;
  fullContext: string;
}

/**
 * 为剧本生成构建上下文
 */
export async function buildEpisodeWritingContext(
  memoryRepo: MemoryRepository,
  projectId: string,
  targetEpisodeNum: number,
): Promise<EpisodeWritingContext> {
  // 获取所有活跃记忆
  const memories = await memoryRepo.findActive(projectId);

  // 按类型分组
  const characters = memories.filter((m) => m.type === "CHARACTER");
  const locations = memories.filter((m) => m.type === "LOCATION");
  const events = memories.filter((m) => m.type === "EVENT").slice(-10); // 最近10个事件
  const foreshadowings = memories.filter(
    (m) => m.type === "FORESHADOWING" && m.isActive,
  );
  const relationships = memories.filter((m) => m.type === "RELATIONSHIP");

  // 构建各部分上下文
  const charactersContext =
    characters.length > 0
      ? `【已出场角色】\n${characters.map((c) => `- ${c.title}：${c.content}`).join("\n")}`
      : "【已出场角色】\n（暂无）";

  const locationsContext =
    locations.length > 0
      ? `【已出现场地】\n${locations.map((l) => `- ${l.title}：${l.content}`).join("\n")}`
      : "【已出现场地】\n（暂无）";

  const eventsContext =
    events.length > 0
      ? `【已发生事件】（最近 ${events.length} 个）\n${events.map((e) => `- ${e.title}：${e.content}`).join("\n")}`
      : "【已发生事件】\n（暂无）";

  const foreshadowingsContext =
    foreshadowings.length > 0
      ? `【活跃伏笔】（未解决的悬念）\n${foreshadowings.map((f) => `- ${f.title}：${f.content}`).join("\n")}`
      : "【活跃伏笔】\n（暂无）";

  const relationshipsContext =
    relationships.length > 0
      ? `【角色关系】\n${relationships.map((r) => `- ${r.title}：${r.content}`).join("\n")}`
      : "【角色关系】\n（暂无）";

  // 组合完整上下文
  const fullContext = [
    charactersContext,
    locationsContext,
    eventsContext,
    foreshadowingsContext,
    relationshipsContext,
    `\n请基于以上剧情记忆，创作第 ${targetEpisodeNum} 集的剧本。保持角色性格、场地描述、伏笔线索的一致性。`,
  ].join("\n\n");

  return {
    characters: charactersContext,
    locations: locationsContext,
    recentEvents: eventsContext,
    activeForeshadowings: foreshadowingsContext,
    relationships: relationshipsContext,
    fullContext,
  };
}

/**
 * 为分镜生成构建上下文（简化版）
 */
export async function buildStoryboardContext(
  memoryRepo: MemoryRepository,
  projectId: string,
  episodeId: string,
): Promise<string> {
  const memories = await memoryRepo.findByProject(projectId, {
    isActive: true,
    minImportance: 3, // 只取重要记忆
  });

  const locations = memories.filter((m) => m.type === "LOCATION");
  const visualStyles = memories.filter((m) => m.type === "VISUAL_STYLE");

  const parts: string[] = [];

  if (locations.length > 0) {
    parts.push("【场地视觉参考】");
    parts.push(locations.map((l) => `- ${l.title}：${l.content}`).join("\n"));
  }

  if (visualStyles.length > 0) {
    parts.push("【视觉风格】");
    parts.push(
      visualStyles.map((v) => `- ${v.title}：${v.content}`).join("\n"),
    );
  }

  return parts.join("\n\n");
}

/**
 * 格式化记忆为简洁字符串（用于LLM提示词）
 */
export function formatMemoriesForPrompt(memories: MemoryItem[]): string {
  if (memories.length === 0) return "（无记忆）";

  return memories
    .map(
      (m) =>
        `[${m.type}] ${m.title}: ${m.content.substring(0, 200)}${m.content.length > 200 ? "..." : ""}`,
    )
    .join("\n");
}
