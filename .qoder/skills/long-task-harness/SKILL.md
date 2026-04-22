---
name: long-task-harness
description: 防止长任务中断，维护跨会话连续性。适用于多会话的复杂项目。
---

# Long Task Harness

解决 AI Agent "交接班" 断档问题——新会话丢失上下文。

## 首次使用

检查 `.long-task-harness/long-task-progress.md` 是否存在：

- **不存在**: 运行 `python3 scripts/init_harness.py` 初始化
- **存在**: 运行 `python3 scripts/read_progress.py` 加载上下文

## 会话启动流程

```bash
python3 scripts/read_progress.py    # 加载最近3个会话
python3 scripts/read_features.py    # 查看未完成任务
git log --oneline -10               # 查看最近提交
```

然后从最新会话的 "Next Steps" 继续工作。

## 工作规范

1. **一次只做一件事** - 专注一个功能
2. **频繁提交** - 小步快跑
3. **更新 features.json** - 功能通过测试后标记
4. **结束会话前更新进度** - 写 long-task-progress.md

## 会话记录格式

```markdown
### Session N | YYYY-MM-DD | Commits: abc123..def456

#### Goal

[一句话目标]

#### Accomplished

- [x] 已完成
- [ ] 未完成（带入下次）

#### Decisions

- **[D1]** 决策内容 - 理由

#### Surprises

- **[S1]** 意外发现 - 影响

#### Next Steps

1. [优先级1] → 影响: feature-001
2. [优先级2]
```

## 关键规则

- 绝不为了通过测试而改测试——修实现
- 绝不未测试就标记功能完成
- 结束前必须更新进度文档
- 频繁提交
