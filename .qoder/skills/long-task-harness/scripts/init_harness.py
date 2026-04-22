#!/usr/bin/env python3
"""Initialize long-task-harness in current project."""

import os
import json
from datetime import datetime

HARNESS_DIR = ".long-task-harness"
PROGRESS_FILE = os.path.join(HARNESS_DIR, "long-task-progress.md")
FEATURES_FILE = os.path.join(HARNESS_DIR, "features.json")
INIT_FILE = os.path.join(HARNESS_DIR, "init.sh")

PROGRESS_TEMPLATE = """# {project_name} - Progress Log

## Project Overview

**Started**: {date}
**Status**: In Progress

### Project Goals

[描述你在构建什么]

### Key Decisions

[记录重要架构或设计决策]

---

## Current State

**Last Updated**: {date}

### What's Working
- [功能列表]

### What's Not Working
- [已知问题]

### Blocked On
- [阻塞项]

---

## Session Log

### Session 1 | {date} | Commits: [first..last]

#### Goal
项目初始化和设置

#### Accomplished
- [x] 初始化 long-task-harness 结构
- [ ] [待完成任务]

#### Decisions
- **[D1]** [决策] - [理由]

#### Next Steps
1. [优先级1]
2. [优先级2]

---

<!--
=============================================================================
SESSION TEMPLATE - 新会话复制下方模板
=============================================================================

### Session N | YYYY-MM-DD | Commits: abc123..def456

#### Goal
[一句话目标]

#### Accomplished
- [x] 已完成
- [ ] 未完成（带入下次）

#### Decisions
- **[DN]** [决策] - [理由]

#### Surprises
- **[SN]** [意外发现] - [影响]

#### Next Steps
1. [优先级1] → 影响: feature-id
2. [优先级2]

=============================================================================
-->
"""

FEATURES_TEMPLATE = {
    "version": "2.0",
    "description": "功能清单与历史追踪",
    "metadata": {
        "project_name": "Your Project",
        "created": datetime.now().strftime("%Y-%m-%d"),
        "last_updated": datetime.now().strftime("%Y-%m-%d"),
        "total_features": 0,
        "completed_features": 0
    },
    "features": []
}

INIT_TEMPLATE = """#!/bin/bash
# 环境初始化脚本
echo "Initializing project environment..."
# 添加你的初始化命令
echo "Environment ready!"
"""

def main():
    cwd = os.getcwd()
    project_name = os.path.basename(cwd)
    
    if os.path.exists(HARNESS_DIR):
        print(f"⚠️  {HARNESS_DIR}/ 已存在")
        return
    
    os.makedirs(HARNESS_DIR)
    
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    # Write progress file
    with open(PROGRESS_FILE, "w") as f:
        f.write(PROGRESS_TEMPLATE.format(project_name=project_name, date=date_str))
    
    # Write features file
    with open(FEATURES_FILE, "w") as f:
        json.dump(FEATURES_TEMPLATE, f, indent=2, ensure_ascii=False)
    
    # Write init script
    with open(INIT_FILE, "w") as f:
        f.write(INIT_TEMPLATE)
    os.chmod(INIT_FILE, 0o755)
    
    print(f"✅ 已在 {cwd} 初始化 long-task-harness")
    print(f"   - {PROGRESS_FILE}")
    print(f"   - {FEATURES_FILE}")
    print(f"   - {INIT_FILE}")

if __name__ == "__main__":
    main()
