#!/usr/bin/env python3

import json
import os
import socket
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse


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


def append_log(project_dir: str, entry: dict) -> None:
    log_path = os.path.join(project_dir, "claude.log")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=True) + "\n")


def _resp_bulk(value: str) -> bytes:
    data = value.encode("utf-8")
    return b"$" + str(len(data)).encode("ascii") + b"\r\n" + data + b"\r\n"


def _resp_array(parts: list[str]) -> bytes:
    out = b"*" + str(len(parts)).encode("ascii") + b"\r\n"
    for part in parts:
        out += _resp_bulk(part)
    return out


def _read_redis_reply(conn: socket.socket) -> bytes:
    first = conn.recv(1)
    if not first:
        raise RuntimeError("redis closed connection")

    if first in (b"+", b"-", b":"):
        line = b""
        while not line.endswith(b"\r\n"):
            chunk = conn.recv(1)
            if not chunk:
                raise RuntimeError("redis reply truncated")
            line += chunk
        return first + line

    if first == b"$":
        length_line = b""
        while not length_line.endswith(b"\r\n"):
            chunk = conn.recv(1)
            if not chunk:
                raise RuntimeError("redis reply truncated")
            length_line += chunk
        length = int(length_line[:-2])
        if length == -1:
            return b"$-1\r\n"
        data = b""
        remaining = length + 2
        while remaining > 0:
            chunk = conn.recv(remaining)
            if not chunk:
                raise RuntimeError("redis reply truncated")
            data += chunk
            remaining -= len(chunk)
        return first + length_line + data

    raise RuntimeError("unsupported redis reply type")


def publish_redis(entry: dict) -> None:
    redis_url = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379")
    redis_channel = os.environ.get("REDIS_CHANNEL", "claude-code:log")

    parsed = urlparse(redis_url)
    if parsed.scheme not in ("redis", "rediss"):
        raise RuntimeError(f"unsupported redis scheme: {parsed.scheme}")

    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 6379
    password = unquote(parsed.password) if parsed.password else None
    db = parsed.path.lstrip("/") if parsed.path else ""

    payload = json.dumps(entry, ensure_ascii=True)

    with socket.create_connection((host, port), timeout=1.5) as conn:
        if parsed.scheme == "rediss":
            raise RuntimeError("rediss is not supported by this hook")

        if password:
            conn.sendall(_resp_array(["AUTH", password]))
            auth_reply = _read_redis_reply(conn)
            if auth_reply.startswith(b"-"):
                raise RuntimeError(auth_reply.decode("utf-8", errors="replace").strip())

        if db:
            conn.sendall(_resp_array(["SELECT", db]))
            select_reply = _read_redis_reply(conn)
            if select_reply.startswith(b"-"):
                raise RuntimeError(select_reply.decode("utf-8", errors="replace").strip())

        conn.sendall(_resp_array(["PUBLISH", redis_channel, payload]))
        publish_reply = _read_redis_reply(conn)
        if publish_reply.startswith(b"-"):
            raise RuntimeError(publish_reply.decode("utf-8", errors="replace").strip())


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

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hook_name": hook_name,
        "payload": payload,
    }
    append_log(project_dir, entry)
    try:
        publish_redis(entry)
    except Exception as exc:
        print(f"Redis publish failed: {exc}", file=sys.stderr)

    if hook_name == "WorktreeCreate":
        return handle_worktree_create(payload, project_dir)

    if hook_name == "WorktreeRemove":
        return handle_worktree_remove(payload, project_dir)

    return 0


if __name__ == "__main__":
    sys.exit(main())
