#!/usr/bin/env python3
"""Read feature tracking status."""

import os
import json
import argparse

import os
SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEATURES_FILE = os.path.join(SKILL_DIR, ".long-task-harness/features.json")

def read_features():
    if not os.path.exists(FEATURES_FILE):
        print(f"❌ {FEATURES_FILE} 不存在")
        return None
    with open(FEATURES_FILE, "r") as f:
        return json.load(f)

def show_incomplete(data):
    """Show only incomplete features."""
    features = data.get("features", [])
    incomplete = [f for f in features if not f.get("passes", False)]
    
    print(f"📋 项目: {data['metadata']['project_name']}")
    print(f"   功能: {data['metadata']['completed_features']}/{data['metadata']['total_features']} 完成\n")
    
    if not incomplete:
        print("✅ 所有功能已完成！")
        return
    
    print(f"📝 未完成的功能 ({len(incomplete)}):")
    for f in incomplete:
        print(f"\n   [{f['id']}] {f['name']}")
        print(f"   {f.get('description', '')}")
        if f.get("notes"):
            print(f"   备注: {f['notes']}")

def show_all(data):
    """Show all features."""
    features = data.get("features", [])
    print(f"📋 所有功能:\n")
    for f in features:
        status = "✅" if f.get("passes") else "⬜"
        print(f"   {status} [{f['id']}] {f['name']}")

def main():
    parser = argparse.ArgumentParser(description="Read feature tracking")
    parser.add_argument("--all", action="store_true", help="显示所有功能")
    args = parser.parse_args()
    
    data = read_features()
    if not data:
        return
    
    if args.all:
        show_all(data)
    else:
        show_incomplete(data)

if __name__ == "__main__":
    main()
