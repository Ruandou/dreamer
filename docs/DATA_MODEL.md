# Dreamer 数据模型文档（与 Prisma 对齐）

> **团队真源**：请以仓库根目录 [`DREAMER_DATA_MODEL.md`](../DREAMER_DATA_MODEL.md)（**v4.1**）为设计规范与术语说明。  
> **实现真源**：字段与关系以 [`packages/backend/prisma/schema.prisma`](../packages/backend/prisma/schema.prisma) 为准；本文随 schema 增量维护，便于在 `docs/` 内查阅。

## 概述

Dreamer 是 AI 短剧生产工作台。当前库中：**以 `Scene`（场次）为视频生成单元**；`Shot` 为场次内镜头/提示词片段；`Take` 为某场次一次模型生成的成片记录；`Composition` 按已选 `Take` 拼接导出。

## 核心概念（与 schema 一致）

| 概念 | Prisma 模型 | 说明 |
|------|----------------|------|
| 剧集 | `Episode` | 每集 `script`（Json，库列 `script`） |
| 场次 / 分镜控制台一行 | `Scene` | 关联 `Location?`，含 `sceneNum`、`status`、文生视频参数等 |
| 镜头 | `Shot` | 属于 `Scene`，拼 prompt，**不**直接挂视频任务 |
| 成片版本 | `Take` | 属于 `Scene`，`model`、`videoUrl`、`isSelected` 等 |
| 台词（TTS） | `SceneDialogue` | 属于 `Scene` + `Character` |
| 片段内角色与动作 | `CharacterShot` | `Shot` + `CharacterImage` |
| 流水线任务 | `PipelineJob` | 含 `jobType`、`currentStep`、`progress`、`progressMeta` |

## 数据模型关系图（摘自关系，非全部字段）

```
User
  └── Project
        ├── Episode[]
        │     ├── script (Json)
        │     ├── synopsis, title, episodeNum
        │     └── Scene[]
        │           ├── locationId → Location?
        │           ├── timeOfDay, description, duration, aspectRatio, visualStyle
        │           ├── seedanceParams (Json?), status
        │           ├── Shot[]
        │           ├── SceneDialogue[]
        │           ├── Take[]
        │           └── CompositionScene[] (被合成引用)
        │
        ├── Character[]
        │     └── CharacterImage[] (parentId 层级)
        │           └── CharacterShot[] (经 Shot)
        │
        ├── Location[] (软删除 deletedAt)
        │     └── Scene[]
        │
        ├── PipelineJob[]
        │     └── PipelineStepResult[]
        │
        ├── ImportTask[]
        ├── ProjectAsset[]
        └── Composition[]
              └── CompositionScene[]  → Scene + Take + order
```

## 模型字段表（与 `schema.prisma` 同步）

### User

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| email | String | 唯一 |
| name, password | String | 登录 |
| apiKey | String? | 可选 |
| deepseekApiUrl, atlasApiKey, atlasApiUrl, arkApiKey, arkApiUrl | String? | 各厂商配置 |
| createdAt, updatedAt | DateTime | |

### Project

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| name | String | |
| description, synopsis | String? | |
| storyContext | String? | @db.Text |
| aspectRatio | String? | 项目默认画幅（9:16、16:9、1:1 等） |
| userId | String | → User |
| visualStyle | String[] | 默认 `[]` |
| createdAt, updatedAt | DateTime | |

### Episode

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| projectId | String | |
| episodeNum | Int | 集号，`@@unique([projectId, episodeNum])` |
| title, synopsis | String? | |
| script | Json? | 完整剧本 JSON（`ScriptContent`） |
| createdAt, updatedAt | DateTime | |

### Scene

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| episodeId | String | |
| sceneNum | Int | 场内序号，`@@unique([episodeId, sceneNum])` |
| locationId | String? | → Location |
| timeOfDay | String? | |
| description | String | 默认 `""` |
| duration | Int | 默认 0，毫秒 |
| aspectRatio | String | 默认 `"9:16"` |
| visualStyle | String[] | 默认 `[]` |
| seedanceParams | Json? | |
| status | String | 默认 `pending` |
| createdAt, updatedAt | DateTime | |

### Shot

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| sceneId | String | |
| shotNum, order | Int | |
| description | String | 镜头/提示词描述 |
| duration | Int | 默认 0 |
| cameraMovement, cameraAngle | String? | |
| createdAt, updatedAt | DateTime | |

### CharacterShot

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| shotId | String | → Shot |
| characterImageId | String | → CharacterImage |
| action | String? | |
| `@@unique([shotId, characterImageId])` | | |

### SceneDialogue

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| sceneId | String | |
| characterId | String | → Character |
| order | Int | |
| startTimeMs, durationMs | Int | |
| text | String | |
| voiceConfig | Json | |
| emotion | String? | |
| createdAt, updatedAt | DateTime | |

### Character / CharacterImage

| Character | | |
| id, projectId, name, description?, voiceId?, voiceConfig? | | `@@unique([projectId, name])` |

| CharacterImage | | |
| id, characterId, name, prompt?, avatarUrl?, imageCost?, parentId?, type, description?, order | | 父子 `ImageHierarchy`；`imageCost` 为方舟图成本估算 |

### Location

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| projectId | String | |
| name | String | Prisma 字段名；DB 列映射 `location` |
| timeOfDay | String? | |
| characters | String[] | 默认 `[]` |
| description | String? | |
| imagePrompt | String? | 定场图 prompt |
| imageUrl | String? | |
| imageCost | Float? | 定场图成本估算 |
| deletedAt | DateTime? | 软删除 |
| createdAt, updatedAt | DateTime | |
| `@@unique([projectId, name])` | | |

### Take（视频生成任务 / 成片版本）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| sceneId | String | |
| model | String | 如 wan2.6 / seedance2.0 |
| externalTaskId | String? | |
| status | String | 默认 `queued` |
| prompt | String | |
| cost | Float? | |
| duration | Int? | |
| videoUrl, thumbnailUrl | String? | |
| errorMsg | String? | |
| isSelected | Boolean | 默认 `false` |
| createdAt, updatedAt | DateTime | |

### ModelApiCall

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| userId | String | → User |
| model, provider | String | |
| prompt | String | |
| requestParams | String? | |
| externalTaskId | String? | |
| status | String | 默认 `pending` |
| responseData | String? | |
| cost, duration | Float? / Int? | |
| errorMsg | String? | |
| takeId | String? | 可选 → Take，`onDelete: SetNull` |
| createdAt, updatedAt | DateTime | |

### Composition / CompositionScene

| Composition | | |
| id, projectId, episodeId, title, status, outputUrl?, createdAt, updatedAt | | 默认 `status = draft` |

| CompositionScene | | |
| id, compositionId, sceneId, takeId, order | | 时间轴顺序；关联 Scene 与选用的 Take |

### ImportTask

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| projectId | String? | 可选 → Project，`onDelete: SetNull` |
| userId | String | |
| status | String | 默认 `pending` |
| content | String | |
| type | String | 默认 `markdown` |
| result | Json? | |
| errorMsg | String? | |
| createdAt, updatedAt | DateTime | |

### PipelineJob / PipelineStepResult

| PipelineJob | | |
| id, projectId, status, jobType, currentStep, progress, progressMeta?, error?, createdAt, updatedAt | | `jobType` 含 `full-pipeline`、`script-first`、`parse-script`、`script-batch`、`episode-storyboard-script` 等 |

| PipelineStepResult | | |
| id, jobId, step, status, input?, output?, error?, createdAt, updatedAt | | `@@unique([jobId, step])` |

### ProjectAsset

| 字段 | 类型 | 说明 |
|------|------|------|
| id, projectId, type, name, url | | |
| description?, tags[], mood[], location?, source? | | |
| createdAt, updatedAt | DateTime | |

## 已移除 / 不在当前 schema 中的内容

- **OutlineJob**：已下线，勿在文档中作为当前表引用。
- 旧文档中的 **Segment / SubShot / VideoTask** 命名：实现上已统一为 **Scene / Shot / Take**（见上表）。
- **Episode** 无持久化 `sceneIndices` 字段；分集与剧本结构见 `script`（JSON，Prisma 字段与库列同名）及业务层类型 `ScriptContent`。

## Pipeline 步骤（业务流水线，非每张表一行）

完整流水线（`full-pipeline`）在代码中为多步编排，与 `PipelineStepResult.step` 对应；另有大纲页异步任务 `script-first` / `script-batch` / `parse-script`、分集「AI 分镜剧本」`episode-storyboard-script` 等，均使用同一 `PipelineJob` 表。细节见 [`DREAMER_DATA_MODEL.md`](../DREAMER_DATA_MODEL.md) 与实现代码。

## 用户操作流程（简）

与当前产品一致：登录 → 项目/大纲 → 解析剧本（须视觉风格）→ 项目详情（角色、场地、分集）→ **分镜控制台**（按 Scene）→ 生成视频（Take）→ 分集成片（Composition）。页面路径见根目录数据模型文档或产品说明。
