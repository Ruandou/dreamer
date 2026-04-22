#!/usr/bin/env python3
"""Quick status overview."""

import os
import json
import re
import subprocess

PROGRESS_FILE = ".long-task-harness/long-task-progress.md"
FEATURES_FILE = ".long-task-harness/features.json"

def get_session_count():
    if not os.path.exists(PROGRESS_FILE):
        return 0
    with open(PROGRESS_FILE) as f:
        content = f.read()
    return len(re.findall(r'### Session \d+', content))

def get_feature_stats():
    if not os.path.exists(FEATURES_FILE):
        return 0, 0
    with open(FEATURES_FILE) as f:
        data = json.load(f)
    features = data.get("features", [])
    total = len(features)
    completed = sum(1 for f in features if f.get("passes"))
    return completed, total

def get_git_info():
    try:
        branch = subprocess.check_output(["git", "branch", "--show-current"], text=True).strip()
    except:
        branch = "?"
    
    try:
        status = subprocess.check_output(["git", "status", "--short"], text=True).strip()
        changes = len([l for l in status.split('\n') if l.strip()])
    except:
        changes = 0
    
    return branch, changes

def main():
    session = get_session_count()
    completed, total = get_feature_stats()
    branch, changes = get_git_info()
    
    print(f"S{session} | F:{completed}/{total} | {branch} (U:{changes})")

if __name__ == "__main__":
    main()
