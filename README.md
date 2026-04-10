# Dreamer - AI短剧工作台

一个基于 Vue 3 + Node.js (Fastify) 的AI短剧生产平台，从"一句话想法"到"成品短视频"，全程可控、可干预、API驱动。

## 技术栈

### 前端
- Vue 3 + TypeScript + Vite
- Naive UI（组件库）
- Pinia（状态管理）
- Vue Router

### 后端
- Node.js + TypeScript
- Fastify（Web框架）
- Prisma + PostgreSQL
- BullMQ + Redis（任务队列）
- MinIO（对象存储）
- FFmpeg（视频合成）

### AI模型
- DeepSeek（剧本生成）
- Wan 2.6（低成本视频试错）
- Seedance 2.0（高光精修）

## 项目结构

```
dreamer/
├── packages/
│   ├── frontend/          # Vue 3 前端应用
│   ├── backend/           # Fastify 后端服务
│   │   ├── prisma/        # 数据库 Schema
│   │   └── src/
│   │       ├── routes/    # API 路由
│   │       ├── services/ # 业务服务
│   │       ├── queues/    # BullMQ 任务队列
│   │       └── plugins/   # Fastify 插件
│   └── shared/            # 共享类型定义 (@dreamer/shared)
├── docker/                # Docker Compose 配置
└── docs/                  # 开发文档
```

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker（用于 PostgreSQL、Redis、MinIO）
- FFmpeg（用于视频合成）

### 1. 克隆并安装依赖

```bash
git clone <repo-url>
cd dreamer
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入必要的 API Key
```

### 3. 启动基础设施

```bash
pnpm docker:up
```

### 4. 初始化数据库

```bash
pnpm db:push
```

### 5. 启动开发服务

```bash
pnpm dev          # 同时启动前端 + 后端
pnpm dev:backend  # 仅后端 (端口 4000)
pnpm dev:frontend # 仅前端 (端口 3000)
pnpm dev:worker  # 视频生成 Worker
```

### 6. 访问应用

- 前端: http://localhost:3000
- 后端 API: http://localhost:4000
- API 文档: http://localhost:4000/docs
- MinIO Console: http://localhost:9001

## 工作流程

1. **创建项目** - 管理短剧项目
2. **AI编剧** - 输入梗概，DeepSeek 生成结构化剧本
3. **角色库** - 创建角色，上传定妆照，管理多服装版本
4. **分镜控制台** - 创建分镜，AI 优化提示词，三阶段视频生成
5. **视频合成** - 排列片段，添加配音/BGM/字幕，导出成品

## 环境变量

详见 `.env.example`，主要变量：

- `DATABASE_URL` - PostgreSQL 连接串
- `REDIS_URL` - Redis 连接串
- `S3_*` - MinIO 对象存储配置
- `JWT_SECRET` - JWT 签名密钥
- `DEEPSEEK_API_KEY` - DeepSeek API
- `ATLAS_API_KEY` - Wan 2.6 API
- `VOLC_*` - Seedance 2.0 API

## 相关资源

- [Fastify](https://fastify.dev/)
- [Vue 3](https://vuejs.org/)
- [Prisma](https://prisma.io/docs)
- [BullMQ](https://docs.bullmq.io/)
- [Naive UI](https://www.naiveui.org/)
