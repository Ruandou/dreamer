#!/usr/bin/env python3
"""Read session progress with context-efficient loading."""

import os
import re
import argparse

PROGRESS_FILE = ".long-task-harness/long-task-progress.md"

def read_file(path):
    if not os.path.exists(path):
        print(f"❌ {path} 不存在，先运行 init_harness.py")
        return None
    with open(path, "r") as f:
        return f.read()

def extract_sessions(content):
    """Extract all session blocks."""
    pattern = r'### Session (\d+).*?(?=### Session \d+|<!--|$)'
    matches = re.findall(pattern, content, re.DOTALL)
    return matches

def get_last_n_sessions(content, n=3):
    """Get header + last N sessions."""
    lines = content.split('\n')
    
    # Find all session headers
    session_indices = []
    for i, line in enumerate(lines):
        if line.startswith('### Session '):
            session_indices.append(i)
    
    if not session_indices:
        return content
    
    # Take header (everything before first session) + last N sessions
    header = '\n'.join(lines[:session_indices[0]])
    
    if len(session_indices) <= n:
        last_sessions = '\n'.join(lines[session_indices[0]:])
    else:
        last_sessions = '\n'.join(lines[session_indices[-n]:])
    
    return header + '\n' + last_sessions

def list_sessions(content):
    """List all sessions compactly."""
    pattern = r'### Session (\d+) \| ([\d-]+) \|.*?\n#### Goal\n(.*?)(?=\n####|$)'
    matches = re.findall(pattern, content, re.DOTALL)
    
    print("📋 所有会话:")
    for num, date, goal in matches:
        goal = goal.strip().replace('\n', ' ')
        print(f"   Session {num} | {date} | {goal[:60]}...")
    print(f"\n共 {len(matches)} 个会话")

def main():
    parser = argparse.ArgumentParser(description="Read long-task progress")
    parser.add_argument("--list", action="store_true", help="列出所有会话")
    parser.add_argument("--session", type=int, help="读取特定会话")
    parser.add_argument("-n", type=int, default=3, help="加载最近N个会话 (默认3)")
    args = parser.parse_args()
    
    content = read_file(PROGRESS_FILE)
    if not content:
        return
    
    if args.list:
        list_sessions(content)
    elif args.session:
        # Extract specific session
        pattern = rf'### Session {args.session}.*?(?=### Session \d+|<!--|$)'
        match = re.search(pattern, content, re.DOTALL)
        if match:
            print(match.group(0))
        else:
            print(f"❌ Session {args.session} 未找到")
    else:
        # Default: header + last N sessions
        print(get_last_n_sessions(content, args.n))

if __name__ == "__main__":
    main()
