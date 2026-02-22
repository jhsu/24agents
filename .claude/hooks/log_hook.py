#!/usr/bin/env python3

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone


def load_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
        return {"raw_payload": data}
    except json.JSONDecodeError:
        return {"raw_payload": raw}


def append_log(project_dir: str, payload: dict, hook_name: str) -> None:
    log_path = os.path.join(project_dir, "claude.log")
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hook_name": hook_name,
        "payload": payload,
    }
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=True) + "\n")


def handle_worktree_create(payload: dict, project_dir: str) -> int:
    name = payload.get("name")
    if not name:
        print("WorktreeCreate hook missing 'name'", file=sys.stderr)
        return 1

    worktrees_root = os.path.join(project_dir, ".claude", "worktrees")
    os.makedirs(worktrees_root, exist_ok=True)
    worktree_path = os.path.abspath(os.path.join(worktrees_root, name))

    result = subprocess.run(
        ["git", "worktree", "add", "--detach", worktree_path, "HEAD"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        error_text = result.stderr.strip() or "git worktree add failed"
        print(error_text, file=sys.stderr)
        return result.returncode

    print(worktree_path)
    return 0


def handle_worktree_remove(payload: dict, project_dir: str) -> int:
    worktree_path = payload.get("worktree_path")
    if not worktree_path:
        return 0

    result = subprocess.run(
        ["git", "worktree", "remove", "--force", worktree_path],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return 0

    shutil.rmtree(worktree_path, ignore_errors=True)
    return 0


def main() -> int:
    payload = load_payload()
    hook_name = str(payload.get("hook_event_name", "Unknown"))

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()
    project_dir = os.path.abspath(project_dir)

    append_log(project_dir, payload, hook_name)

    if hook_name == "WorktreeCreate":
        return handle_worktree_create(payload, project_dir)

    if hook_name == "WorktreeRemove":
        return handle_worktree_remove(payload, project_dir)

    return 0


if __name__ == "__main__":
    sys.exit(main())
