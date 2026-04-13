# Dreamer 数据模型文档

> **真源已迁移**：请以仓库根目录 [`DREAMER_DATA_MODEL.md`](../DREAMER_DATA_MODEL.md)（**v4.1**）为团队设计规范；本文档保留历史说明，新开发请勿以本文为准。

## 概述

Dreamer 是一个 AI 短剧生产工作台，从剧本到成品的全流程平台。

## 核心概念

- **Episode (剧集)** - 一个短剧可以有多集
- **Segment (分镜片段)** - 视频生成单元，每个 Segment 生成一个视频
- **SubShot (子片段)** - Segment 内的时序描述，说明每个时间段的画面内容
- **Location (场地)** - 剧本场景/地点
- **Character (角色)** - 从剧本提取的角色
- **CharacterImage (角色形象)** - 角色的具体形象，支持父子层级

## 数据模型关系图

```
User
  └── Project
        ├── Episode[]
        │     ├── script (完整剧本 JSON)
        │     ├── synopsis (分集摘要)
        │     ├── sceneIndices (场景索引列表 Int[])
        │     │
        │     └── Segment[] (分镜片段 = 视频生成单元)
        │           ├── locationId → Location
        │           ├── duration (总时长毫秒)
        │           ├── prompt (组合后的提示词)
        │           ├── cameraMovement (运镜)
        │           ├── visualStyle (视觉风格数组)
        │           ├── status (pending/generating/completed/failed)
        │           │
        │           ├── SubShot[] (子片段，时序描述)
        │           │     ├── order (顺序)
        │           │     ├── durationMs (时长)
        │           │     └── description (描述)
        │           │
        │           ├── CharacterSegment[] (出现的角色)
        │           │     ├── characterImageId → CharacterImage
        │           │     └── action (该片段中的动作/情绪)
        │           │
        │           ├── VoiceSegment[] (语音片段)
        │           │
        │           └── VideoTask[] (视频生成任务)
        │                 ├── model (wan2.6/seedance2.0)
        │                 └── status (queued/processing/completed/failed)
        │
        ├── Character[] (角色，从剧本提取)
        │     ├── voiceId (音色克隆 ID)
        │     ├── voiceConfig (全局默认音色配置)
        │     └── images[] (形象，parentId 层级)
        │           ├── parentId=null (基础形象)
        │           └── parentId→基础 (衍生：服装/表情/pose)
        │
        ├── VoiceSegment[] (语音片段)
        │     ├── segmentId → Segment
        │     ├── characterId → Character
        │     ├── order, startTimeMs, durationMs
        │     ├── text (台词文本)
        │     ├── voiceConfig (音色配置)
        │     └── emotion (情绪标签)
        │
        ├── Location[] (场地，从剧本提取)
        │     ├── location (地点名)
        │     ├── timeOfDay (日/夜/晨/昏)
        │     ├── characters (出场角色列表)
        │     ├── description (场景描述)
        │     └── imageUrl (场地图片)
        │
        ├── ProjectAsset[] (项目素材库)
        │     ├── type (character/background/atmosphere/prop/style)
        │     ├── url (素材 URL)
        │     └── tags, mood, location
        │
        ├── PipelineJob[] (流水线执行任务)
        │     └── PipelineStepResult[] (各步骤结果)
        │
        └── Composition[] (视频合成)
              └── CompositionSegment[] (片段关联)
```

## 模型详细说明

### User (用户)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| email | String | 邮箱（唯一） |
| name | String | 用户名 |
| password | String | 密码（加密） |
| apiKey | String? | API Key |
| deepseekApiUrl | String? | DeepSeek API 地址 |
| atlasApiKey | String? | Atlas API Key |
| atlasApiUrl | String? | Atlas API 地址 |
| arkApiKey | String? | Ark API Key |
| arkApiUrl | String? | Ark API 地址 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Project (项目)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| name | String | 项目名称 |
| description | String? | 项目描述 |
| userId | String | 所有者 ID |
| visualStyle | String[] | 视频风格数组 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Episode (剧集)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| projectId | String | 所属项目 ID |
| episodeNum | Int | 集号 |
| title | String? | 标题 |
| script | Json? | 完整剧本 JSON |
| synopsis | String? | 分集摘要 |
| sceneIndices | Int[] | 场景索引列表 |

### Segment (分镜片段) - 视频生成单元

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| episodeId | String | 所属剧集 ID |
| segmentNum | Int | 分镜序号 |
| description | String? | 分镜描述 |
| locationId | String? | 关联场地 ID |
| duration | Int? | 总时长(毫秒) |
| cameraMovement | String? | 运镜方式 |
| aspectRatio | String? | 画面比例 9:16/16:9/1:1 |
| prompt | String | 视频生成提示词 |
| visualStyle | String[] | 视觉风格数组 |
| status | String | 状态 pending/generating/completed/failed |
| seedanceParams | Json? | Seedance API 参数 |

### SubShot (子片段)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| segmentId | String | 所属分镜 ID |
| order | Int | 顺序 |
| durationMs | Int | 时长(毫秒) |
| description | String | 描述文本 |

### Character (角色)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| projectId | String | 所属项目 ID |
| name | String | 角色名 |
| description | String? | 角色描述 |
| voiceId | String? | 音色克隆 ID（预留） |
| voiceConfig | Json? | 全局默认音色配置 |

### CharacterImage (角色形象)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| characterId | String | 所属角色 ID |
| name | String | 形象名称 |
| avatarUrl | String? | 形象图片 URL |
| parentId | String? | 父形象 ID（null 为基础形象） |
| type | String | 类型：base/outfit/expression/pose |
| description | String? | 描述 |
| order | Int | 排序 |

### Location (场地)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| projectId | String | 所属项目 ID |
| location | String | 地点名称 |
| timeOfDay | String? | 日/夜/晨/昏 |
| characters | String[] | 出场角色列表 |
| description | String? | 场景描述 |
| imageUrl | String? | 场地图片 URL（AI 生成） |

### CharacterSegment (片段角色)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| segmentId | String | 所属分镜 ID |
| characterImageId | String | 使用的角色形象 ID |
| action | String? | 该片段中角色的动作/情绪 |

### VoiceSegment (语音片段)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| segmentId | String | 所属分镜 ID |
| characterId | String | 对应角色 ID |
| order | Int | 播放顺序 |
| startTimeMs | Int | 开始时间（毫秒） |
| durationMs | Int | 语音时长（毫秒） |
| text | String | 台词文本 |
| voiceConfig | Json | 音色配置 |
| emotion | String? | 情绪标签 |

### VideoTask (视频任务)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| segmentId | String | 所属分镜 ID |
| model | String | 模型：wan2.6/seedance2.0 |
| status | String | 状态 |
| prompt | String | 提示词 |
| videoUrl | String? | 生成的视频 URL |
| thumbnailUrl | String? | 缩略图 URL |
| cost | Float? | 费用 |
| duration | Int? | 生成耗时 |
| isSelected | Boolean | 是否选中为最终版本 |

### ModelApiCall (API 调用记录)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| userId | String | 用户 ID |
| model | String | 模型名称 |
| provider | String | 提供商：volcengine, atlas, openai, deepseek |
| prompt | String | 请求提示词 |
| requestParams | String? | 请求参数 JSON |
| externalTaskId | String? | 外部 API 任务 ID |
| status | String | 状态 pending/processing/completed/failed |
| responseData | String? | 响应数据 JSON |
| cost | Float? | 费用 |
| duration | Int? | 生成耗时 |
| errorMsg | String? | 错误信息 |
| videoTaskId | String? | 关联的 VideoTask ID |

### Composition (视频合成)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| projectId | String | 所属项目 ID |
| title | String | 合成标题 |
| duration | Int | 总时长（秒） |
| width | Int | 宽度，默认 1080 |
| height | Int | 高度，默认 1920 |
| status | String | 状态 draft/composing/exporting/exported |
| voiceover | String? | 配音文件 URL |
| bgm | String? | 背景音乐 URL |
| subtitles | String? | 字幕文件 URL |
| outputUrl | String? | 最终成品 URL |

### CompositionSegment (合成片段关联)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| compositionId | String | 所属合成 ID |
| segmentId | String | 引用的分镜 ID |
| order | Int | 时间轴顺序 |
| startTime | Float | 起始时间（秒） |
| endTime | Float | 结束时间（秒） |
| transition | String? | 转场类型 none/fade/dissolve/wipe/slide |

### ProjectAsset (项目素材库)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| projectId | String | 所属项目 ID |
| type | String | 类型：character/background/atmosphere/prop/style |
| name | String | 素材名称 |
| url | String | 素材 URL |
| description | String? | 素材描述 |
| tags | String[] | 标签数组 |
| mood | String[] | 氛围标签数组 |
| location | String? | 适用场地 |

### ImportTask (剧本导入任务)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| projectId | String? | 所属项目 ID |
| userId | String | 用户 ID |
| status | String | 状态 pending/processing/completed/failed |
| content | String | 导入内容 |
| type | String | 内容类型，默认 markdown |
| result | Json? | 导入结果 |
| errorMsg | String? | 错误信息 |

### OutlineJob (大纲生成任务)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| userId | String | 用户 ID |
| status | String | 状态 pending/running/completed/failed |
| idea | String | 用户输入的想法 |
| result | Json? | 生成结果（outline + rawScript） |
| error | String? | 错误信息 |

### PipelineJob (Pipeline 执行任务)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| projectId | String | 所属项目 ID |
| status | String | 状态 pending/running/completed/failed |
| currentStep | String | 当前步骤 |
| progress | Int | 进度 0-100 |
| error | String? | 错误信息 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### PipelineStepResult (Pipeline 步骤结果)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| jobId | String | 所属 Job ID |
| step | String | 步骤 |
| status | String | 状态 pending/processing/completed/failed |
| input | Json? | 步骤输入数据 |
| output | Json? | 步骤输出数据 |
| error | String? | 错误信息 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

## Pipeline 步骤

Pipeline 执行流程（7 步）：

```
Step 1: 剧本生成 (script-writing)
  输入: idea
  输出: ScriptContent { title, summary, scenes[] }

Step 2: 智能分集 (episode-splitting)
  输入: ScriptContent, targetDuration
  输出: EpisodePlan[]

Step 3: 动作提取 (action-extraction)
  输入: scenes[], characters[]
  输出: SceneActions[]

Step 3.5: 素材匹配 (asset-matching)
  输入: scenes[], characterImages[], projectAssets[]
  输出: SceneAssetRecommendation[]

Step 4: 分镜生成 (storyboard-generation)
  输入: episodes, scenes, assetRecommendations
  输出: StoryboardSegment[]

Step 5: Seedance 参数化 (seedance-parametrization)
  输入: storyboard[]
  输出: SeedanceSegmentConfig[]

Step 6: 视频生成 (video-generation)
  输入: seedanceConfigs[]
  输出: VideoTask[] → videoUrl
```

注意：角色动作在 `action-extraction` 阶段提取，存储在 `SceneActions` 中。

## 用户操作流程

```
1. 登录 → 项目列表页
         ↓
2. 输入想法/导入剧本 → 点击创建
         ↓
3. 生成大纲页面 → 梗概/第一集/可选批量剩余集（**不**要求先选视觉风格）
         ↓
3b. 选择视觉风格（多选）→ 点击「解析剧本」（**仅**此步要求 `visualStyle`）
         ↓
4. 解析完成进入项目详情 → 后续可 Pipeline / 分镜等
         ↓
5. Pipeline 完成 → 跳转到项目详情页
         ↓
6. 项目详情页 → 分镜控制台入口 → 查看/编辑 Segment
         ↓
7. 点击"生成视频" → VideoTask 生成 → 轮询状态 → 视频完成
         ↓
8. 视频合成 (Composition) → 导出最终成片
```

## 页面清单

| 页面 | 路径 | 作用 |
|------|------|------|
| 项目列表页 | `/projects` | 展示所有项目，有输入框创建入口 |
| 生成大纲页 | `/generate?projectId=` | 创意/梗概/剧本；**批量剩余集**不写风格；**解析剧本前**选风格并 `POST .../parse` |
| 项目详情页 | `/project/:id` | 左侧 tab 导航，显示基础信息/角色/场景/分集 |

## 项目详情页 Tab

| Tab | 内容 |
|-----|------|
| 基础信息 | 项目名称、类型、风格、故事概要、Pipeline 入口 |
| 角色 | Character[] 列表，点击进入详情 |
| 场景 | Location[] 列表，点击进入详情 |
| 分集 | Episode[] 列表，可展开查看 Segments |

## 视频风格

用户可选择多个风格组合，影响视频生成参数：

| 风格 | visualStyle 值 | 说明 |
|------|---------------|------|
| 真人写实 | realistic | 追求真实感 |
| 电影风格 | cinematic | 有艺术感/高级感 |
| 复古调色 | vintage | 有年代感/特殊氛围 |

存储为数组：`visualStyle: string[]`（如 `["realistic", "vintage"]`）

组合示例：
- 真人写实 + 复古调色 = 真实感 + 年代感
- 电影风格 + 复古调色 = 艺术感老电影质感

## 命名说明

| 概念 | 模型 | 说明 |
|------|------|------|
| 剧本场景 | Location | 剧本中的地点/场景 |
| 分镜片段 | Segment | 视频生成单元 |
| 子片段 | SubShot | Segment 内的时序描述 |
| 角色形象 | CharacterImage | 角色的具体形象（基础/服装/表情/pose） |
