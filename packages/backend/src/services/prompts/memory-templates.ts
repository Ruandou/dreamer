import type { PromptTemplate } from '../prompts/template-engine.js'

/**
 * 记忆提取模板 - 从剧本中提取剧情记忆
 */
export const MEMORY_EXTRACTION_TEMPLATE: PromptTemplate = {
  id: 'memory-extraction',
  version: '1.1.0',
  systemPrompt: `你是剧情记忆提取专家。你的任务是从剧本中提取关键剧情元素，帮助后续剧集保持连贯性。

## 提取重点

### 必须提取：
1. **CHARACTER（角色）**：
   - 新出场角色的姓名、身份、性格特征
   - 角色的关键动作或决定
   - 角色的重要台词或口头禅

2. **EVENT（事件）**：
   - 推动主线剧情的关键事件
   - 角色做出的重要决定
   - 冲突、转折、高潮

3. **PLOT_POINT（情节点）**：
   - 故事的重大转折
   - 主角目标的变化
   - 重要真相的揭露

4. **FORESHADOWING（伏笔）**：
   - 未解的悬念
   - 暗示未来发展的线索
   - 角色的秘密或隐藏身份

5. **RELATIONSHIP（关系）**：
   - 角色之间关系的变化
   - 新的联盟或敌对关系
   - 感情线的发展

### 选择性提取：
6. **LOCATION（场地）**：仅当场地有特殊意义时
7. **VISUAL_STYLE（视觉风格）**：仅当有独特的视觉元素时

## 提取规则
- **具体而非泛泛**：不要写"主角遇到困难"，要写"主角发现师父是幕后黑手"
- **可操作**：提取的信息应该能指导后续剧情写作
- **精炼**：每个记忆 1-3 句话，不要复述整个剧情
- **只提新内容**：已有记忆不要重复提取
- **重要性评分**：
  - 5分：主线剧情的关键转折
  - 4分：重要角色发展或事件
  - 3分：有意义的支线情节
  - 2分：补充细节
  - 1分：可有可无的信息

## 输出格式
返回合法 JSON，格式如下：
\`\`\`json
{
  "memories": [
    {
      "type": "CHARACTER|EVENT|PLOT_POINT|FORESHADOWING|RELATIONSHIP|LOCATION|VISUAL_STYLE",
      "category": "细分类型（如：protagonist, antagonist, revelation, mystery等）",
      "title": "简短标题（10字以内）",
      "content": "具体描述（50-150字，包含关键细节）",
      "tags": ["相关标签"],
      "importance": 3,
      "metadata": {
        "characters": ["涉及的角色名"],
        "location": "发生地（如有）"
      }
    }
  ]
}
\`\`\``,
  userPromptTemplate: `## 任务
提取第 {{episodeNum}} 集的关键剧情记忆，用于指导后续剧集创作。

## 剧本内容
{{script}}

{{#existingMemories}}
## 已有记忆（避免重复）
{{existingMemories}}
{{/existingMemories}}

{{^existingMemories}}
（这是首集，建立基础记忆库）
{{/existingMemories}}

## 要求
- 提取 3-8 条最有价值的记忆
- 确保每条记忆都能帮助后续剧集保持连贯
- 返回 JSON 格式`,
  metadata: {
    category: 'memory',
    creativity: 0.4, // 稍微提高创意度，让提取更灵活
    maxOutputTokens: 4000,
    description: '从剧本中提取剧情记忆',
    tags: ['memory', 'extraction', 'analysis']
  }
}

/**
 * 记忆合并模板 - 合并重复的记忆条目
 */
export const MEMORY_MERGE_TEMPLATE: PromptTemplate = {
  id: 'memory-merge',
  version: '1.0.0',
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
    category: 'memory',
    creativity: 0.2,
    maxOutputTokens: 3000,
    description: '合并重复的剧情记忆',
    tags: ['memory', 'merge', 'deduplication']
  }
}

/**
 * 上下文构建模板 - 为剧本生成构建上下文
 */
export const CONTEXT_BUILD_TEMPLATE: PromptTemplate = {
  id: 'context-build',
  version: '1.0.0',
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
    category: 'memory',
    creativity: 0.4,
    maxOutputTokens: 3000,
    description: '将剧情记忆整理为写作上下文',
    tags: ['memory', 'context', 'writing']
  }
}

export const MEMORY_TEMPLATES: PromptTemplate[] = [
  MEMORY_EXTRACTION_TEMPLATE,
  MEMORY_MERGE_TEMPLATE,
  CONTEXT_BUILD_TEMPLATE
]
