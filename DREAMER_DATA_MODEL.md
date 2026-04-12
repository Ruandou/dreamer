# Dreamer 数据模型文档 v4.1

> 最后更新：2026-04-12  
> 状态：已定稿，可直接用于开发  
> 核心设计：**以 Scene（场次）为视频生成单元**；**Shot（镜头）** 仅用于精细化控制与 **Prompt 拼接**，不单独生成视频；**Take** 挂在 Scene；**Composition MVP** 仅做 Scene 视频拼接。

完整字段表、Pipeline 六步、rawScript 示例与术语对照以团队协作文档为准；实现代码以仓库内 [`packages/backend/prisma/schema.prisma`](packages/backend/prisma/schema.prisma) 为单一事实来源。

## 要点摘要

- **Scene**：`episodeId`、`sceneNum`、`locationId`、`timeOfDay`、文学性 `description`、`duration`、`aspectRatio`、`visualStyle`、`seedanceParams`、`status`。
- **Shot**：`sceneId`、`shotNum`、`order`、`description`、`duration`（ms）、`cameraMovement`、`cameraAngle`；**不绑 Take**。
- **Take**：`sceneId`、`model`、`status`、`videoUrl`（整场）、`thumbnailUrl`、`duration`、`cost`、`isSelected` 等。
- **SceneDialogue**（实现层模型名，对应概念「台词」）：`sceneId`、`characterId`、`order`、`startTimeMs`、`durationMs`、`text`、`voiceConfig`、`emotion`。
- **Composition（MVP）**：`projectId`、`episodeId`、`title`、`status`（`draft` | `processing` | `completed` | `failed`）、`outputUrl`。
- **CompositionScene（MVP）**：`compositionId`、`sceneId`、`takeId`、`order`；无转场 / 无音轨 / 无字幕字段。
- **Episode**：`rawScript`（Json）；**无** `sceneIndices` 持久化字段。
- **Project**：含 `synopsis`；**Location**：字段 `name`（场地名）。

## Prompt 拼接（规范）

同一 Scene 下按 `Shot.order` 排序，将多镜头描述拼为一条模型输入（分隔符如 `[Cut to]` 由实现常量配置，并需单测）。

## 相关文档

- 历史说明见 [`docs/data-model.md`](docs/data-model.md)（顶部应指向本文件为真源）。
