# AI 编剧助手

## 概述

AI 编剧助手提供多轮对话式的剧本创作辅助，支持 SSE 流式响应、剧本上下文感知、快捷指令和编辑建议应用。

## 架构

```
┌─────────────────┐     SSE      ┌──────────────────┐     OpenAI API     ┌──────────────┐
│   Vue Frontend  │ ◄──────────► │  Backend Routes   │ ◄───────────────► │  DeepSeek/LLM │
│   ChatPanel     │   streaming  │  POST /api/chat/  │   streaming       │  Provider     │
└────────┬────────┘              └────────┬─────────┘                    └──────────────┘
         │                                │
         │  Pinia Store                   │  Chat Service
         │  useChatStream                 │  Chat Repository
         │  chat.ts                       │  Prisma ORM
         ▼                                ▼
┌─────────────────┐              ┌──────────────────┐
│  Components     │              │  Database        │
│  ChatInput      │              │  ChatConversation│
│  ChatMessageList│              │  ChatMessage     │
│  DiffModal      │              └──────────────────┘
└─────────────────┘
```

## 数据库模型

### ChatConversation

| 字段        | 类型     | 说明             |
| ----------- | -------- | ---------------- |
| `id`        | String   | 主键，CUID       |
| `userId`    | String   | 关联用户         |
| `scriptId`  | String?  | 关联剧本（可选） |
| `title`     | String   | 对话标题         |
| `createdAt` | DateTime | 创建时间         |
| `updatedAt` | DateTime | 更新时间         |

### ChatMessage

| 字段             | 类型     | 说明                                       |
| ---------------- | -------- | ------------------------------------------ |
| `id`             | String   | 主键，CUID                                 |
| `conversationId` | String   | 关联对话                                   |
| `role`           | String   | `user` 或 `assistant`                      |
| `content`        | String   | 消息内容                                   |
| `status`         | String   | `pending`/`streaming`/`completed`/`failed` |
| `inputTokens`    | Int      | 输入 token 数                              |
| `outputTokens`   | Int      | 输出 token 数                              |
| `costCNY`        | Decimal  | 成本（元）                                 |
| `metadata`       | Json?    | 扩展元数据（如 suggestedEdit）             |
| `createdAt`      | DateTime | 创建时间                                   |

## 后端 API

### 基础路径

```
POST /api/chat/conversations
```

### 创建对话

```
POST /api/chat/conversations
```

**请求体:**

```json
{
  "scriptId": "clxxx123",
  "title": "关于第三幕的讨论"
}
```

**响应:**

```json
{
  "id": "clxxx456",
  "scriptId": "clxxx123",
  "title": "关于第三幕的讨论",
  "createdAt": "2026-04-22T10:00:00.000Z",
  "updatedAt": "2026-04-22T10:00:00.000Z"
}
```

### 获取对话列表

```
GET /api/chat/conversations?scriptId=clxxx123&limit=20&offset=0
```

**响应:**

```json
{
  "items": [...],
  "total": 5
}
```

### 获取对话及消息

```
GET /api/chat/conversations/:id?limit=40&before=2026-04-22T10:00:00.000Z
```

**响应:**

```json
{
  "conversation": { ... },
  "messages": [
    {
      "id": "clxxx789",
      "conversationId": "clxxx456",
      "role": "user",
      "content": "帮我续写这段剧本...",
      "status": "completed",
      "metadata": null,
      "createdAt": "2026-04-22T10:00:00.000Z"
    }
  ]
}
```

### 发送消息（SSE 流式）

```
POST /api/chat/conversations/:id/messages
```

**请求体:**

```json
{
  "content": "帮我润色这段对白",
  "scriptContent": "剧本内容...",
  "scriptTitle": "我的剧本",
  "quickCommand": "polish"
}
```

**响应 (SSE):**

```
event: connected
data: {"messageId":"clxxx789"}

event: token
data: {"content":"这里"}

event: token
data: {"content":"是流式返回的内容"}

event: done
data: {
  "fullContent": "完整的回复内容",
  "usage": {
    "inputTokens": 1200,
    "outputTokens": 800,
    "totalTokens": 2000,
    "costCNY": 0.008
  },
  "suggestedEdit": {
    "type": "replace",
    "content": "修改后的剧本",
    "description": "优化了对白表达"
  }
}

event: error
data: {"message": "错误信息"}
```

### 删除对话

```
DELETE /api/chat/conversations/:id
```

## 快捷指令

| ID         | 标签 | 说明                           |
| ---------- | ---- | ------------------------------ |
| `continue` | 续写 | 根据已有内容继续创作下文       |
| `polish`   | 润色 | 优化语言表达，使对白更自然流畅 |
| `expand`   | 扩写 | 丰富场景细节，增加描写和对话   |
| `condense` | 缩写 | 精简冗余内容，保留核心情节     |

快捷指令会扩展用户的输入内容，将指令说明附加到消息中。

## 上下文管理

### Token 估算

使用启发式方法估算 token 数量：

- 1 个中文字符 ≈ 1.5 tokens
- 1 个英文单词 ≈ 1.3 tokens

### 上下文窗口策略

1. **系统提示词** 始终包含（作为第一条消息）
2. **第一条用户消息** 始终包含（对话主题）
3. 从最新消息开始**倒序遍历**，尽可能多地包含历史消息
4. 如果中间消息被截断，插入省略提示：`（已省略 N 条历史消息，保留开头和最新消息）`

### 配置常量

| 常量                            | 值    | 说明                 |
| ------------------------------- | ----- | -------------------- |
| `CHAT_MAX_CONTEXT_TOKENS`       | 16000 | 最大上下文 token 数  |
| `CHAT_MAX_RESPONSE_TOKENS`      | 4000  | 最大响应 token 数    |
| `CHAT_MAX_HISTORY_MESSAGES`     | 40    | 最大历史消息数       |
| `CHAT_TEMPERATURE`              | 0.7   | 生成温度             |
| `CHAT_STREAM_HEARTBEAT_MS`      | 15000 | SSE 心跳间隔（毫秒） |
| `CHAT_SCRIPT_CONTEXT_MAX_CHARS` | 8000  | 剧本上下文最大字符数 |

## 系统提示词

系统提示词包含：

1. **基础角色定义**：AI 编剧助手的身份和职责
2. **剧本上下文**（如果关联了剧本）：
   ```
   === 剧本上下文 ===
   标题: 《xxx》
   内容:
   （剧本内容，截断至 8000 字符）
   ```
3. **编辑建议格式说明**：
   ```
   如果需要建议用户修改剧本内容，请在回复末尾使用以下格式：
   [EDIT_SUGGESTION]
   {
     "type": "replace|insert|append",
     "content": "修改后的内容",
     "description": "修改说明"
   }
   [EDIT_SUGGESTION]
   ```

## 前端组件

### 组件树

```
Studio.vue
├── ChatPanel.vue              # 主容器
│   ├── ConversationSidebar.vue  # 对话列表侧边栏
│   ├── ChatMessageList.vue      # 消息列表（滚动区域）
│   │   └── ChatMessageBubble.vue  # 单条消息气泡
│   │       └── MarkdownRenderer.vue  # Markdown 渲染
│   │       └── ApplyChangesButton.vue  # 应用编辑按钮
│   │   └── TypingIndicator.vue  # 输入中动画
│   ├── ChatInput.vue            # 输入框
│   └── QuickCommandBar.vue      # 快捷指令栏
└── DiffModal.vue              # 差异对比弹窗
```

### 状态管理 (Pinia)

```typescript
// stores/chat.ts

interface ChatState {
  conversations: ChatConversation[]
  activeConversationId: string | null
  messages: Map<string, ChatMessage[]>
  streamingContent: string | null
  isStreaming: boolean
}
```

**核心 Actions:**

| Action                  | 说明                    |
| ----------------------- | ----------------------- |
| `fetchConversations`    | 获取对话列表            |
| `createNewConversation` | 创建新对话              |
| `selectConversation`    | 选择并加载对话          |
| `sendMessage`           | 发送消息（触发 SSE 流） |
| `abortCurrentStream`    | 中止当前流式请求        |

### 流式通信 (useChatStream)

```typescript
// composables/useChatStream.ts

const { start, abort } = useChatStream()

await start(
  conversationId,
  { content, scriptContent },
  {
    onToken(content) {
      /* 逐字显示 */
    },
    onDone(fullContent, usage, suggestedEdit) {
      /* 完成处理 */
    },
    onError(message) {
      /* 错误处理 */
    }
  }
)
```

**SSE 解析:**

使用 `fetch()` + `ReadableStream` 手动解析 SSE 事件，因为需要 POST 请求和认证头。

## 编辑建议应用

当 AI 回复中包含 `[EDIT_SUGGESTION]` 标记时：

1. 后端解析 JSON 并作为 `suggestedEdit` 传入 `done` 事件
2. 前端在消息气泡底部显示"应用更改"按钮
3. 点击后打开 DiffModal，展示修改前后的对比
4. 用户确认后，将修改应用到编辑器

## 可观测性

所有 LLM 调用都会记录到 `ModelApiCall` 表：

- 输入/输出 token 数
- 成本（元）
- 用户 ID、操作类型
- 请求参数摘要

可通过 `GET /api/model-api-calls` 查询。

## 文件索引

### 后端

| 文件                                        | 说明                |
| ------------------------------------------- | ------------------- |
| `src/repositories/chat-repository.ts`       | 数据访问层          |
| `src/services/chat/chat.constants.ts`       | 常量和快捷指令定义  |
| `src/services/chat/chat-prompts.ts`         | 系统提示词构建      |
| `src/services/chat/chat-context-builder.ts` | 上下文窗口管理      |
| `src/services/chat/chat-stream-service.ts`  | OpenAI SDK 流式调用 |
| `src/services/chat/chat-service.ts`         | 业务逻辑编排        |
| `src/routes/chat.ts`                        | REST API 路由       |

### 前端

| 文件                                          | 说明           |
| --------------------------------------------- | -------------- |
| `src/api/index.ts`                            | API 请求函数   |
| `src/composables/useChatStream.ts`            | SSE 流式 Hook  |
| `src/stores/chat.ts`                          | Pinia 状态管理 |
| `src/components/chat/ChatPanel.vue`           | 主容器组件     |
| `src/components/chat/ConversationSidebar.vue` | 对话列表       |
| `src/components/chat/ChatMessageList.vue`     | 消息列表       |
| `src/components/chat/ChatMessageBubble.vue`   | 消息气泡       |
| `src/components/chat/MarkdownRenderer.vue`    | Markdown 渲染  |
| `src/components/chat/ApplyChangesButton.vue`  | 应用编辑按钮   |
| `src/components/chat/TypingIndicator.vue`     | 输入中动画     |
| `src/components/chat/QuickCommandBar.vue`     | 快捷指令栏     |
| `src/components/chat/ChatInput.vue`           | 输入框         |
| `src/components/chat/DiffModal.vue`           | 差异对比弹窗   |

### 共享类型

| 文件                                 | 说明                                       |
| ------------------------------------ | ------------------------------------------ |
| `packages/shared/src/types/index.ts` | `ChatConversation`、`ChatMessage` 接口定义 |

## 测试

### 后端测试

```bash
cd packages/backend && pnpm test --run
```

测试覆盖：

- Repository CRUD 操作
- 上下文窗口构建逻辑
- 系统提示词生成
- 流式服务异常处理
- API 路由认证和权限检查

### 前端测试

```bash
cd packages/frontend && pnpm test
```

## 启动命令

```bash
# 后端（含 SSE 端点）
pnpm dev:backend

# 前端
pnpm dev:frontend
```

## 数据库同步

```bash
pnpm docker:up    # 启动 PostgreSQL
pnpm db:push      # 同步 ChatConversation 和 ChatMessage 表
```
