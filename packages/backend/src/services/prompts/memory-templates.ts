import type { PromptTemplate } from "../prompts/template-engine.js";

/**
 * 记忆提取模板 - 从剧本中提取剧情记忆
 */
export const MEMORY_EXTRACTION_TEMPLATE: PromptTemplate = {
  id: "memory-extraction",
  version: "1.0.0",
  systemPrompt: `你是剧情记忆提取专家。你的任务是从剧本中提取关键剧情元素，并以结构化 JSON 格式返回。

需要提取的内容：
1. **CHARACTER**（角色）：新出场角色的姓名、身份、特征、重要性
2. **LOCATION**（场地）：新场地的名称、类型、视觉特征
3. **EVENT**（事件）：关键情节事件、发生了什么、影响
4. **PLOT_POINT**（情节点）：推动剧情发展的关键转折点
5. **FORESHADOWING**（伏笔）：暗示未来发展的线索、悬念
6. **RELATIONSHIP**（关系）：角色之间的关系变化
7. **VISUAL_STYLE**（视觉风格）：独特的视觉风格描述

提取规则：
- 只提取**新出现**或**有重要变化**的元素
- 对于已有元素，只在有重大变化时才更新
- 重要性评分 1-5，5 为最关键
- 伏笔必须标注是否已解决（isActive）
- 使用中文描述
- 返回合法的 JSON 格式

输出格式：
\`\`\`json
{
  "memories": [
    {
      "type": "CHARACTER|LOCATION|EVENT|PLOT_POINT|FORESHADOWING|RELATIONSHIP|VISUAL_STYLE",
      "category": "细分类型（可选）",
      "title": "简短标题",
      "content": "详细描述",
      "tags": ["标签1", "标签2"],
      "importance": 3,
      "metadata": {
        "episodeNum": 1,
        "characters": ["角色名"],
        "location": "场地名"
      }
    }
  ]
}
\`\`\``,
  userPromptTemplate: `第 {{episodeNum}} 集剧本：

{{script}}

{{#existingMemories}}
已有记忆（避免重复提取）：
{{existingMemories}}
{{/existingMemories}}

{{^existingMemories}}
（这是首集，无需考虑已有记忆）
{{/existingMemories}}

请提取本集的关键剧情记忆，返回 JSON 格式。`,
  metadata: {
    category: "memory",
    creativity: 0.3, // 低创意，高准确度
    maxOutputTokens: 4000,
    description: "从剧本中提取剧情记忆",
    tags: ["memory", "extraction", "analysis"],
  },
};

/**
 * 记忆合并模板 - 合并重复的记忆条目
 */
export const MEMORY_MERGE_TEMPLATE: PromptTemplate = {
  id: "memory-merge",
  version: "1.0.0",
  systemPrompt: `你是剧情记忆整理专家。你的任务是识别并合并重复或高度相似的剧情记忆。

合并规则：
1. **相同角色**的不同描述 → 合并为一条，保留最完整的信息
2. **相同场地**的不同描述 → 合并为一条
3. **同一事件**的不同视角 → 合并为一条，保留多角度信息
4. **相关伏笔** → 保持独立，但建立关联（relatedIds）

输出格式：
\`\`\`json
{
  "merges": [
    {
      "keepId": "保留的记忆ID",
      "mergeIds": ["被合并的记忆ID1", "被合并的记忆ID2"],
      "mergedTitle": "合并后的标题",
      "mergedContent": "合并后的内容"
    }
  ]
}
\`\`\``,
  userPromptTemplate: `项目中的剧情记忆：

{{memories}}

请识别并合并重复的记忆条目。`,
  metadata: {
    category: "memory",
    creativity: 0.2,
    maxOutputTokens: 3000,
    description: "合并重复的剧情记忆",
    tags: ["memory", "merge", "deduplication"],
  },
};

/**
 * 上下文构建模板 - 为剧本生成构建上下文
 */
export const CONTEXT_BUILD_TEMPLATE: PromptTemplate = {
  id: "context-build",
  version: "1.0.0",
  systemPrompt: `你是剧情上下文整理专家。你的任务是将结构化的剧情记忆整理成适合 LLM 阅读的自然语言上下文。

整理规则：
1. 按类型分组：角色、场地、已发生事件、伏笔、角色关系
2. 按重要性排序，最重要的在前
3. 保持简洁，每个条目 1-2 句话
4. 使用中文
5. 突出当前活跃（isActive）的伏笔和关系`,
  userPromptTemplate: `请为第 {{targetEpisodeNum}} 集的创作整理剧情上下文。

【角色记忆】
{{#characters}}
- {{title}}：{{content}}
{{/characters}}

【场地记忆】
{{#locations}}
- {{title}}：{{content}}
{{/locations}}

【已发生事件】（最近 10 个）
{{#events}}
- {{title}}：{{content}}
{{/events}}

【活跃伏笔】（未解决的悬念）
{{#foreshadowings}}
- {{title}}：{{content}}
{{/foreshadowings}}

【角色关系】
{{#relationships}}
- {{title}}：{{content}}
{{/relationships}}

请将以上信息整理成连贯的自然语言上下文，用于指导第 {{targetEpisodeNum}} 集的剧本创作。`,
  metadata: {
    category: "memory",
    creativity: 0.4,
    maxOutputTokens: 3000,
    description: "将剧情记忆整理为写作上下文",
    tags: ["memory", "context", "writing"],
  },
};

export const MEMORY_TEMPLATES: PromptTemplate[] = [
  MEMORY_EXTRACTION_TEMPLATE,
  MEMORY_MERGE_TEMPLATE,
  CONTEXT_BUILD_TEMPLATE,
];
