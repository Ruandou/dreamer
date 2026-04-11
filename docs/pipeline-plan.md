# Pipeline 重构计划

## 目标

将 Pipeline 打造成项目的**核心功能**，实现从 idea/剧本到完整分镜数据的全流程：

```
输入想法/导入剧本 → 生成大纲 → 选择风格 → Pipeline 执行 → 分镜控制台 → 生成视频
```

整个过程的数据必须**完整持久化**，任何一步失败都能断点续传。

---

## 一、核心用户旅程

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户登录                                    │
│                      Login → 项目列表页                               │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        项目列表页                                     │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ 💡 输入想法，快速创建短剧...  或  导入已有剧本            │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│   项目列表...                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      生成大纲页面                                     │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ 剧本大纲预览（标题、摘要、类型、场景数）                   │   │
│   │ 风格选择：真人写实 / 电影风格 / 复古调色                  │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│   [取消]                              [进入流水线 →]              │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Pipeline 执行中                                   │
│                                                                       │
│   步骤进度: pending → running → completed                          │
│                                                                       │
│   Pipeline 步骤:                                                      │
│   1. 剧本生成                                                      │
│   2. 提取角色 + 场景 (Character, Location)                        │
│   3. 分集规划 (Episode)                                             │
│   4. 生成分镜 Segments (含 SubShots, CharacterSegments)            │
│   5. Seedance 参数化                                              │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       项目详情页                                     │
│                                                                       │
│   左侧 Tab 导航:                                                    │
│   [基础信息] [角色] [场景] [分集]                               │
│                                                                       │
│   Tab 内容:                                                         │
│   - 基础信息: 项目名称、类型、风格、故事概要、Pipeline 入口        │
│   - 角色: Character[] 列表，点击进入详情                         │
│   - 场景: Location[] 列表，点击进入详情                          │
│   - 分集: Episode[] 列表，可展开查看 Segments                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、视频风格 (单选)

| 风格     | visualStyle 值 | 说明              |
| -------- | -------------- | ----------------- |
| 真人写实 | realistic      | 追求真实感        |
| 电影风格 | cinematic      | 有艺术感/高级感   |
| 复古调色 | vintage        | 有年代感/特殊氛围 |

---

## 三、Pipeline 数据流

```
idea
  │
  ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Step 1: 剧本生成                                                      │
│ 输入: idea (string)                                                   │
│ 输出: ScriptContent                                                   │
│                                                                       │
│ 保存:                                                                  │
│   - Episode.script = JSON.stringify(scriptContent)                    │
│   - Episode.title = scriptContent.title                               │
│   - Episode.synopsis = scriptContent.summary                         │
└───────────────────────────────────────────────────────────────────────┘
  │
  ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Step 2: 角色提取                                                      │
│ 输入: scriptContent                                                   │
│ 输出: Character[]                                                     │
│                                                                       │
│ 保存:                                                                  │
│   - 创建 Character 记录 (projectId, name, description)               │
└───────────────────────────────────────────────────────────────────────┘
  │
  ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Step 3: 分集规划                                                      │
│ 输入: scriptContent                                                   │
│ 输出: EpisodePlan[]                                                   │
│                                                                       │
│ 保存:                                                                  │
│   - Episode.episodeNum = plan.episodeNum                              │
│   - Episode.synopsis = plan.synopsis                                  │
│   - Episode.sceneIndices = plan.sceneIndices                          │
└───────────────────────────────────────────────────────────────────────┘
  │
  ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Step 4: 分镜生成                                                      │
│ 输入: episodePlan, scriptContent                                       │
│ 输出: StoryboardSegment[]                                              │
│                                                                       │
│ 保存:                                                                  │
│   - Scene.episodeId = episode.id                                      │
│   - Scene.segmentNum = segment.segmentNum                            │
│   - Scene.prompt = segment.seedancePrompt                             │
│   - Scene.duration = segment.duration                                 │
│   - Scene.cameraMovement = segment.cameraMovement                     │
│   - Scene.status = 'pending'                                          │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 四、API 接口

### 4.1 生成大纲

```
POST /api/projects/generate-outline
Body: { idea: string }
Response: {
  outline: {
    title: string
    summary: string
    metadata: { genre, style, tone, ... }
    sceneCount: number
  }
}
```

### 4.2 Pipeline Job

```
POST   /api/pipeline/jobs              - 创建 Job
GET    /api/pipeline/jobs              - 列出项目的 Job
GET    /api/pipeline/jobs/:jobId       - 获取 Job 详情
GET    /api/pipeline/jobs/:jobId/status - 获取状态 (轮询用)
GET    /api/pipeline/jobs/:jobId/result - 获取结果
DELETE /api/pipeline/jobs/:jobId       - 取消 Job
POST   /api/pipeline/jobs/:jobId/retry - 重试失败的 Job
```

---

## 五、数据模型

### 5.1 PipelineJob

```prisma
model PipelineJob {
  id            String            @id @default(cuid())
  projectId     String
  userId        String
  status        PipelineJobStatus @default(PENDING)
  currentStep   PipelineStep?
  progress      Int              @default(0)
  idea          String
  options       Json?
  error         String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  stepResults   PipelineStepResult[]
}

enum PipelineJobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

enum PipelineStep {
  SCRIPT_WRITING
  CHARACTER_EXTRACTION
  EPISODE_SPLITTING
  STORYBOARD_GENERATION
  SEEDANCE_PARAMETRIZATION
}
```

### 5.2 PipelineStepResult

```prisma
model PipelineStepResult {
  id          String     @id @default(cuid())
  jobId       String
  step        PipelineStep
  status      StepStatus @default(PENDING)
  data        Json?
  duration    Int?
  error       String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  job         PipelineJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@unique([jobId, step])
}
```

### 5.3 Episode 扩展

```prisma
model Episode {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id])
  episodeNum    Int
  title         String?
  script        String?    // 完整剧本 JSON
  synopsis      String?    // 分集摘要
  sceneIndices  Int[]      // 场景索引列表
  pipelineJobId String?    // 关联的 PipelineJob

  segments      Segment[]

  @@unique([projectId, episodeNum])
  @@index([projectId])
}
```

### 5.4 Segment (原 Scene)

```prisma
model Segment {
  id              String      @id @default(cuid())
  episodeId       String
  episode         Episode     @relation(fields: [episodeId], references: [id])
  segmentNum      Int         // 片段号
  description     String?     // 分镜描述
  prompt          String?     // 视频提示词
  duration        Int?        // 时长（秒）
  aspectRatio     String?     // 9:16 / 16:9 / 1:1
  cameraMovement  String?     // 运镜方式
  visualStyle     String[]    // 视觉风格
  status          SegmentStatus @default(PENDING)
  seedanceParams  Json?       // Seedance API 参数

  locationId      String?
  location        Location?   @relation(fields: [locationId], references: [id])

  subShots        SubShot[]
  characterSegments CharacterSegment[]

  @@unique([episodeId, segmentNum])
  @@index([episodeId])
}
```

### 5.5 Location

```prisma
model Location {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  location    String    // 地点名称
  timeOfDay   String?   // 日/夜/晨/昏
  characters  String[]  // 出场角色
  description String?

  segments    Segment[]

  @@unique([projectId, location, timeOfDay])
  @@index([projectId])
}
```

### 5.6 SubShot

```prisma
model SubShot {
  id          String   @id @default(cuid())
  segmentId   String
  segment     Segment  @relation(fields: [segmentId], references: [id], onDelete: Cascade)
  subShotNum  Int      // 子片段序号
  startMs    Int      // 起始时间（毫秒）
  endMs      Int      // 结束时间（毫秒）
  description String?  // 描述
  prompt      String?  // 提示词
  cameraMovement String? // 运镜
}
```

### 5.7 CharacterSegment

```prisma
model CharacterSegment {
  id               String @id @default(cuid())
  segmentId        String
  segment          Segment @relation(fields: [segmentId], references: [id], onDelete: Cascade)
  characterImageId String
  characterImage   CharacterImage @relation(fields: [characterImageId], references: [id])
  action           String? // 该片段中角色的动作

  @@unique([segmentId, characterImageId])
}
```

---

## 六、文件清单

### 后端新增

| 文件 | 说明 |
| ---- | ---- |
| `src/routes/pipeline.ts` | Pipeline 路由 |
| `src/services/script-writer.ts` | 剧本生成服务 |
| `src/services/episode-splitter.ts` | 分集服务 |
| `src/services/action-extractor.ts` | 动作提取服务 |
| `src/services/scene-asset.ts` | 场景素材服务 |
| `src/services/storyboard-generator.ts` | 分镜生成服务 |
| `src/services/seedance-optimizer.ts` | Seedance 优化服务 |
| `src/services/pipeline-orchestrator.ts` | 流水线编排 |
| `src/services/pipeline-executor.ts` | 流水线执行器 |

### 前端新增/修改

| 文件 | 说明 |
| ---- | ---- |
| `src/views/Projects.vue` | 列表页（输入想法入口） |
| `src/views/Generate.vue` | 生成大纲页 |
| `src/views/ProjectPipeline.vue` | Pipeline 执行页 |

### API

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| POST | `/api/projects/generate-outline` | 生成大纲 |
| POST | `/api/pipeline/jobs` | 创建 Pipeline Job |
| GET | `/api/pipeline/jobs/:jobId/status` | 获取状态 |

---

## 七、预期效果

| 指标       | 改造前     | 改造后           |
| ---------- | ---------- | ---------------- |
| 前端响应   | 等待 57s+ | 立即返回 jobId   |
| 进度反馈   | 无         | 实时步骤+百分比  |
| 剧本持久化 | 内存       | Episode.script   |
| 角色持久化 | 未实现     | Character 表     |
| 分集持久化 | 内存       | Episode.synopsis |
| 分镜持久化 | 部分字段   | 完整字段         |
| 失败恢复   | 需从头重跑 | 断点续传         |
