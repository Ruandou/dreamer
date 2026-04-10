# Dreamer - AI 短剧工作台 开发计划

## 项目概述

**项目名称**: Dreamer - AI 短剧工作台
**核心目标**: 将"一句话创意"转化为"完整短剧视频"的 AI 短剧生产平台
**目标用户**: 短剧创作者、内容团队、AI 视频制作爱好者

### 核心特征

- **人工干预**: 每一步都可人工审核、编辑、调整
- **AI 辅助**: AI 提供创意、扩展、优化建议
- **API 驱动**: 集成顶级 AI 模型服务

---

## 技术架构

### 技术栈

#### 前端
- Vue 3 + TypeScript + Vite
- Naive UI (组件库)
- Pinia (状态管理)
- Vue Router (路由)
- Axios (HTTP 客户端)

#### 后端
- Node.js + TypeScript
- Fastify (Web 框架)
- Prisma ORM
- PostgreSQL (数据库)
- Redis (缓存/消息队列)
- BullMQ (任务队列)
- MinIO/S3 (对象存储)

#### AI 模型 API
- **DeepSeek V4**: 剧本生成、提示词优化
- **Wan 2.6**: 低成本视频试错
- **Seedance 2.0**: 高质量视频定稿

### 项目结构 (Monorepo)

```
dreamer/
├── packages/
│   ├── frontend/          # Vue 3 前端应用
│   ├── backend/           # Node.js/Fastify 后端
│   └── shared/            # 共享类型定义
├── docker/                # Docker Compose 配置
├── docs/                  # 项目文档
└── .env                   # 环境变量（不提交）
```

---

## 核心功能流程

### 1. 项目管理
- 创建/编辑/删除项目
- 项目列表展示
- 项目设置（名称、描述）

### 2. AI 编剧
- 输入一句话梗概 → DeepSeek 生成结构化剧本
- 剧本包含：场景、地点、时间、角色、对话、动作
- 手动编辑剧本内容

### 3. 角色/场景库
- 管理角色列表
- 上传角色定妆照（参考图）
- 添加角色不同服装版本
- 角色描述信息

### 4. 分镜设计
- 剧本 → 分镜（场景）分解
- 每个分镜可编辑：
  - 场景描述
  - 视频提示词
  - 角色参考图
- AI 提示词优化
- **三阶段视频生成流程**:
  1. **试错阶段**: Wan 2.6 生成 3-5 个低成本草稿
  2. **筛选阶段**: 人工选择最佳构图
  3. **定稿阶段**: Seedance 2.0 生成高质量最终版

### 5. 视频生成
- 选择分镜 → 选择模型 → 提交任务
- 任务状态: queued → processing → completed/failed
- 视频预览与下载
- 批量生成支持

### 6. 视频合成
- 时间轴编排：将片段按顺序排列
- 添加配音 (voiceover)
- 添加背景音乐 (BGM)
- 添加字幕文件
- FFmpeg 合成导出最终成品

---

## 开发阶段

### Phase 1: 项目初始化 ✅
- [x] Monorepo 结构搭建
- [x] Docker Compose 配置 (PostgreSQL, Redis, MinIO)
- [x] 基础前端页面框架
- [x] 基础后端 API 框架

### Phase 2: 用户认证 ✅
- [x] 用户注册/登录
- [x] JWT Token 认证
- [x] 资源所有权验证

### Phase 3: 核心功能开发
- [x] 项目管理 (CRUD)
- [x] AI 编剧 (DeepSeek 集成)
- [ ] 角色管理
- [ ] 分镜设计
- [ ] 视频生成 (Wan 2.6, Seedance 2.0)
- [ ] 视频合成 (FFmpeg)

### Phase 4: 基础设施完善
- [ ] SSE 实时进度推送
- [ ] 任务队列管理
- [ ] 成本统计面板

### Phase 5: 优化与部署
- [ ] 前端优化
- [ ] 错误处理完善
- [ ] 部署文档

---

## API 路由

### 认证
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/me | 获取当前用户 |

### 项目
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/projects | 获取项目列表 |
| POST | /api/projects | 创建项目 |
| GET | /api/projects/:id | 获取项目详情 |
| PUT | /api/projects/:id | 更新项目 |
| DELETE | /api/projects/:id | 删除项目 |

### 剧本
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/episodes | 获取剧本列表 |
| POST | /api/episodes | 创建剧本 |
| GET | /api/episodes/:id | 获取剧本详情 |
| PUT | /api/episodes/:id | 更新剧本 |
| DELETE | /api/episodes/:id | 删除剧本 |
| POST | /api/episodes/:id/expand | AI 扩写剧本 |

### 角色
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/characters | 获取角色列表 |
| POST | /api/characters | 创建角色 |
| GET | /api/characters/:id | 获取角色详情 |
| PUT | /api/characters/:id | 更新角色 |
| DELETE | /api/characters/:id | 删除角色 |
| POST | /api/characters/:id/avatar | 上传角色定妆照 |
| POST | /api/characters/:id/versions | 添加服装版本 |

### 分镜
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/scenes | 获取分镜列表 |
| POST | /api/scenes | 创建分镜 |
| GET | /api/scenes/:id | 获取分镜详情 |
| PUT | /api/scenes/:id | 更新分镜 |
| DELETE | /api/scenes/:id | 删除分镜 |
| POST | /api/scenes/:id/generate | 生成视频 |
| POST | /api/scenes/:id/optimize-prompt | AI 优化提示词 |
| POST | /api/scenes/batch-generate | 批量生成视频 |

### 视频任务
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/tasks | 获取任务列表 |
| GET | /api/tasks/:id | 获取任务详情 |
| POST | /api/tasks/:id/cancel | 取消任务 |
| POST | /api/tasks/:id/retry | 重试失败任务 |

### 视频合成
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/compositions | 获取合成列表 |
| POST | /api/compositions | 创建合成 |
| GET | /api/compositions/:id | 获取合成详情 |
| PUT | /api/compositions/:id | 更新合成 |
| DELETE | /api/compositions/:id | 删除合成 |
| PUT | /api/compositions/:id/timeline | 更新时间轴 |
| POST | /api/compositions/:id/audio | 上传音频 |
| POST | /api/compositions/:id/subtitles | 上传字幕 |
| POST | /api/compositions/:id/export | 导出成品 |

### 统计
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/stats/cost | 获取成本统计 |

---

## 环境变量

```bash
# 数据库
DATABASE_URL="postgresql://dreamer:dreamer123@localhost:5432/dreamer?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# MinIO / S3
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin123"
S3_BUCKET_VIDEOS="dreamer-videos"
S3_BUCKET_ASSETS="dreamer-assets"
S3_REGION="us-east-1"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# DeepSeek API
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"

# Atlas Cloud API (Wan 2.6)
ATLAS_API_KEY="your-atlas-api-key"
ATLAS_API_URL="https://api.atlascloud.com"

# 火山引擎 API (Seedance 2.0)
VOLC_ACCESS_KEY="your-volc-access-key"
VOLC_SECRET_KEY="your-volc-secret-key"
VOLC_API_URL="https://volcbytebytes.example.com"

# CORS（可选，生产环境设置具体域名）
CORS_ORIGIN="http://localhost:3000"

# FFmpeg
FFMPEG_PATH="/usr/local/bin/ffmpeg"
```

---

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填写必要的 API Key
```

### 3. 启动基础设施

```bash
pnpm docker:up
```

### 4. 初始化数据库

```bash
pnpm db:push
```

### 5. 启动开发服务器

```bash
# 启动后端 (端口 4000)
pnpm dev:backend

# 启动前端 (端口 3000)
pnpm dev:frontend
```

### 6. 访问应用

- 前端: http://localhost:3000
- 后端 API: http://localhost:4000
- API 文档: http://localhost:4000/documentation

---

## 数据库模型

### User
- 用户账号信息

### Project
- 项目，包含多个剧本和角色

### Episode
- 剧本，存储结构化剧本 JSON

### Character
- 角色，包含定妆照和服装版本

### Scene
- 分镜，对应视频生成单元

### VideoTask
- 视频生成任务

### Composition
- 视频合成项目

### Segment
- 时间轴片段

---

## 三阶段视频生成流程

```
┌─────────────────────────────────────────────────────────────┐
│  阶段 1: 试错 (Wan 2.6)                                      │
│  ├── 低成本 ($0.01/秒)                                       │
│  ├── 快速生成 (10-30秒)                                      │
│  └── 生成 3-5 个版本供选择                                    │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  阶段 2: 筛选                                                │
│  ├── 人工预览所有草稿                                         │
│  ├── 选择最佳构图/动作                                        │
│  └── 可调整提示词重新生成                                      │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  阶段 3: 定稿 (Seedance 2.0)                                 │
│  ├── 高质量输出                                              │
│  ├── 4K 分辨率支持                                           │
│  └── 精细控制                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 参考资源

- [Vue 3 文档](https://vuejs.org/)
- [Fastify 文档](https://www.fastify.io/)
- [Prisma 文档](https://prisma.io/)
- [Naive UI 文档](https://www.naiveui.org/)
- [DeepSeek API](https://platform.deepseek.com/)
- [FFmpeg 文档](https://ffmpeg.org/documentation.html)
