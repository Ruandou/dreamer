# AI短剧工作台 - 天工开物

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
- DeepSeek V4（剧本生成）
- Wan 2.6（低成本视频试错，$0.07/秒）
- Seedance 2.0（高光精修，约1元/秒）

## 项目结构

```
dreamer/
├── packages/
│   ├── frontend/          # Vue 3 前端应用
│   ├── backend/           # Fastify 后端服务
│   │   ├── prisma/        # 数据库 Schema
│   │   ├── src/
│   │   │   ├── routes/    # API 路由
│   │   │   ├── services/  # 业务服务
│   │   │   ├── queues/    # BullMQ 任务队列
│   │   │   └── plugins/   # Fastify 插件
│   └── shared/            # 共享类型定义
├── docker/                 # Docker Compose 配置
├── package.json           # 根 workspace 配置
└── README.md
```

## 快速开始

### 前置要求
- Node.js >= 18.0.0
- Docker（用于 PostgreSQL、Redis、MinIO）
- FFmpeg（用于视频合成，`brew install ffmpeg`）

### 1. 启动基础设施

```bash
# 复制环境变量配置
cp .env.example .env

# 启动 PostgreSQL、Redis、MinIO
npm run docker:up
```

### 2. 安装依赖

```bash
npm install
```

### 3. 初始化数据库

```bash
npm run db:install
```

### 4. 启动开发服务器

```bash
# 启动前端、后端 API 服务
npm run dev

# 单独启动后端
npm run dev:backend

# 单独启动视频生成 Worker（需要先启动 Redis）
npm run dev:worker

# 单独启动前端
npm run dev:frontend
```

### 5. 访问应用

- 前端: http://localhost:3000
- 后端 API: http://localhost:4000
- API 文档: http://localhost:4000/docs
- MinIO Console: http://localhost:9001（账号：minioadmin / minioadmin123）

## 工作流程

### 1. 项目管理
创建和管理短剧项目

### 2. AI编剧
- 输入故事梗概
- 调用 DeepSeek API 生成结构化剧本
- 人工编辑调整

### 3. 角色库
- 创建角色（名称、描述）
- 上传定妆照
- 管理多服装版本

### 4. 分镜控制台
- 从剧本创建分镜
- AI 优化提示词
- 三阶段视频生成流程：
  - **试错阶段**：Wan 2.6 批量生成草稿（$0.7/10秒）
  - **筛选阶段**：人工挑选满意构图
  - **定稿阶段**：Seedance 2.0 生成高质量成品

### 5. 视频合成
- 拖拽排列分镜片段
- 上传配音、BGM、字幕
- FFmpeg 合成导出成品

## 环境变量

```env
# 数据库
DATABASE_URL="postgresql://dreamer:dreamer123@localhost:5432/dreamer"

# Redis
REDIS_URL="redis://localhost:6379"

# MinIO / S3
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin123"

# JWT
JWT_SECRET="your-super-secret-jwt-key"

# AI API
DEEPSEEK_API_KEY="your-deepseek-api-key"
ATLAS_API_KEY="your-atlas-api-key"  # Wan 2.6
VOLC_ACCESS_KEY="your-volc-access-key"  # Seedance 2.0
VOLC_SECRET_KEY="your-volc-secret-key"
```

## API 端点

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户

### 项目
- `GET /api/projects` - 项目列表
- `POST /api/projects` - 创建项目
- `GET /api/projects/:id` - 项目详情

### 剧本
- `POST /api/episodes` - 创建集
- `POST /api/episodes/:id/expand` - AI 扩写剧本

### 角色
- `POST /api/characters` - 创建角色
- `POST /api/characters/:id/avatar` - 上传定妆照

### 分镜
- `POST /api/scenes` - 创建分镜
- `POST /api/scenes/:id/generate` - 生成视频
- `POST /api/scenes/:id/optimize-prompt` - AI 优化提示词

### 合成
- `POST /api/compositions` - 创建合成
- `PUT /api/compositions/:id/timeline` - 更新时间轴
- `POST /api/compositions/:id/export` - 导出视频

### 统计
- `GET /api/stats/me` - 用户成本统计
- `GET /api/stats/projects/:projectId` - 项目成本统计
- `GET /api/stats/trend` - 每日成本趋势

## 相关资源

- [BullMQ文档](https://docs.bullmq.io/)
- [Fastify文档](https://fastify.dev/)
- [Prisma文档](https://prisma.io/docs)
- [Naive UI文档](https://www.naiveui.org/)
- [Vue文档](https://vuejs.org/)
