#!/usr/bin/env python3
"""Block agent edits that reduce active expect( or .should( calls in test files."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

TEST_FILE_RE = re.compile(
    r"(?:^|/)(?:tests/.*\.(?:spec|test)\.[jt]sx?|web/cypress/.*\.cy\.tsx?)$",
    re.IGNORECASE,
)


def read_hook_input() -> dict:
    raw = sys.stdin.read().lstrip("\ufeff")
    if not raw.strip():
        print("guard-test-assertions: empty stdin", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"guard-test-assertions: invalid JSON — {exc}", file=sys.stderr)
        sys.exit(1)


def normalize_path(file_path: str) -> str:
    return file_path.replace("\\", "/")


def is_test_file(file_path: str) -> bool:
    return bool(TEST_FILE_RE.search(normalize_path(file_path)))


def count_active_expects(content: str) -> int:
    total = 0
    for line in content.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        code_part = line.split("//", 1)[0]
        total += code_part.count("expect(")
        total += code_part.count(".should(")
    return total


def reconstruct_before(after_content: str, edits: list) -> str | None:
    content = after_content
    for edit in reversed(edits):
        if not isinstance(edit, dict):
            return None
        old_string = edit.get("old_string")
        new_string = edit.get("new_string")
        if old_string is None or new_string is None:
            return None
        if new_string not in content:
            return None
        content = content.replace(new_string, old_string, 1)
    return content


def block_message(file_path: str, before: int, after: int) -> str:
    return (
        f"Blocked: test assertions weakened in {file_path} — active expect( "
        f"and .should( count {before} -> {after}. Do not delete or comment out assertions to "
        f"make tests pass. Fix the app, locator, or test data instead."
    )


def tool_input_of(payload: dict) -> dict:
    tool_input = payload.get("tool_input") or {}
    if isinstance(tool_input, str):
        try:
            tool_input = json.loads(tool_input)
        except json.JSONDecodeError:
            return {}
    return tool_input if isinstance(tool_input, dict) else {}


def edits_from_tool_input(tool_input: dict) -> list:
    if "old_string" in tool_input or "new_string" in tool_input:
        return [
            {
                "old_string": tool_input.get("old_string") or "",
                "new_string": tool_input.get("new_string") or "",
            }
        ]
    content = tool_input.get("content")
    contents = tool_input.get("contents")
    if isinstance(content, str) or isinstance(contents, str):
        return [
            {
                "old_string": "",
                "new_string": content if isinstance(content, str) else contents,
                "fullReplace": True,
            }
        ]
    return []


def apply_edits_to_content(content: str, edits: list) -> str | None:
    next_content = content
    for edit in edits:
        if not isinstance(edit, dict):
            return None
        old_string = edit.get("old_string")
        new_string = edit.get("new_string")
        if old_string is None or new_string is None:
            return None
        if edit.get("fullReplace"):
            next_content = new_string
            continue
        if old_string not in next_content:
            return None
        next_content = next_content.replace(old_string, new_string, 1)
    return next_content


def assertion_delta(edits: list) -> int:
    delta = 0
    for edit in edits:
        if not isinstance(edit, dict):
            continue
        old_s = edit.get("old_string") or ""
        new_s = edit.get("new_string") or ""
        delta += count_active_expects(old_s) - count_active_expects(new_s)
    return delta


def allow_pre_tool_use(detail: str | None) -> None:
    print(json.dumps({"permission": "allow"}))
    if detail:
        print(detail, file=sys.stderr)
    sys.exit(0)


def deny_pre_tool_use(msg: str) -> None:
    print(json.dumps({"permission": "deny", "user_message": msg, "agent_message": msg}))
    print(msg, file=sys.stderr)
    sys.exit(2)


def handle_pre_tool_use(payload: dict) -> None:
    tool_input = tool_input_of(payload)
    file_path = (
        tool_input.get("path")
        or tool_input.get("file_path")
        or tool_input.get("filePath")
        or payload.get("file_path")
    )
    if not file_path or not is_test_file(str(file_path)):
        allow_pre_tool_use(None)

    edits = edits_from_tool_input(tool_input)
    path = Path(file_path)
    try:
        before_content = path.read_text(encoding="utf-8") if path.is_file() else ""
    except OSError as exc:
        print(f"guard-test-assertions: cannot read {file_path} — {exc}", file=sys.stderr)
        sys.exit(1)

    projected = apply_edits_to_content(before_content, edits) if edits else before_content
    if projected is None:
        delta = assertion_delta(edits)
        if delta > 0:
            after_count = count_active_expects(before_content) - delta
            deny_pre_tool_use(block_message(str(file_path), after_count + delta, after_count))
        allow_pre_tool_use(
            f"guard-test-assertions: OK — edit does not apply, assertion count unchanged"
        )

    before_count = count_active_expects(before_content)
    after_count = count_active_expects(projected)
    if before_count > after_count:
        deny_pre_tool_use(block_message(str(file_path), before_count, after_count))
    allow_pre_tool_use(
        f"guard-test-assertions: OK — {after_count} active expect( and .should( preserved"
    )


def main() -> None:
    payload = read_hook_input()
    if (payload.get("hook_event_name") or "afterFileEdit") == "preToolUse":
        handle_pre_tool_use(payload)

    file_path = payload.get("file_path")
    if not file_path:
        print("guard-test-assertions: missing file_path", file=sys.stderr)
        sys.exit(1)

    if not is_test_file(file_path):
        sys.exit(0)

    edits = payload.get("edits") or []
    path = Path(file_path)
    if not path.is_file():
        print(f"guard-test-assertions: file not found — {file_path}", file=sys.stderr)
        sys.exit(1)

    after_content = path.read_text(encoding="utf-8")
    after_count = count_active_expects(after_content)

    before_content = reconstruct_before(after_content, edits)
    if before_content is not None:
        before_count = count_active_expects(before_content)
    else:
        delta = 0
        for edit in edits:
            if not isinstance(edit, dict):
                continue
            old_s = edit.get("old_string") or ""
            new_s = edit.get("new_string") or ""
            delta += count_active_expects(old_s) - count_active_expects(new_s)
        before_count = after_count + delta

    if before_count > after_count:
        msg = block_message(file_path, before_count, after_count)
        out = {"user_message": msg, "agent_message": msg}
        print(json.dumps(out))
        print(msg, file=sys.stderr)
        sys.exit(2)

    print(
        f"guard-test-assertions: OK — {after_count} active expect( and .should( preserved",
        file=sys.stderr,
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
