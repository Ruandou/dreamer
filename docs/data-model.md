# Dreamer 数据模型文档

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
        │           └── CharacterSegment[] (出现的角色)
        │                 ├── characterImageId → CharacterImage
        │                 └── action (该片段中的动作/情绪)
        │
        ├── Character[] (角色，从剧本提取)
        │     └── images[] (形象，parentId 层级)
        │           ├── parentId=null (基础形象)
        │           └── parentId→基础 (衍生：服装/表情/pose)
        │
        └── Location[] (场地，从剧本提取)
              ├── location (地点名)
              ├── timeOfDay (日/夜/晨/昏)
              ├── characters (出场角色列表)
              └── description (场景描述)
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
| ... | ... | 其他 API 配置 |

### Project (项目)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| name | String | 项目名称 |
| description | String? | 项目描述 |
| userId | String | 所有者 ID |
| visualStyle | String[] | 视频风格数组 |

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

Pipeline 执行流程：

```
Step 1: 剧本生成 (SCRIPT_WRITING)
  输入: idea 或已有剧本
  输出: ScriptContent { title, summary, scenes[] }
  保存: Episode.script

Step 2: 提取角色 + 场景 (EXTRACT_ENTITIES)
  输入: scriptContent.scenes[]
  输出: Character[], Location[]
  保存: Character 表, Location 表

Step 3: 分集规划 (EPISODE_SPLITTING)
  输入: scriptContent, targetEpisodes
  输出: EpisodePlan[]
  保存: Episode.episodeNum, synopsis, sceneIndices

Step 4: 生成分镜 (GENERATE_SEGMENTS)
  输入: episodes, scriptContent
  输出: Segment[], SubShot[], CharacterSegment[]
  保存: Segment 表, SubShot 表, CharacterSegment 表

Step 5: Seedance 参数化 (PARAMETRIZE)
  输入: segments
  输出: SeedanceSegmentConfig[]
  保存: Segment.prompt, Segment.seedanceParams
```

注意：角色动作在 SubShot.description 或 CharacterSegment.action 中描述。

## 用户操作流程

```
1. 登录 → 项目列表页
         ↓
2. 输入想法/导入剧本 → 点击创建
         ↓
3. 生成大纲页面 → 显示大纲 → 选择风格(多选)
         ↓
4. 点击"进入流水线" → Pipeline 执行
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
| 生成大纲页 | `/projects/new` 或 `/generate` | 输入想法→生成大纲→选择风格→进入流水线 |
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
