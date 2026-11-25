#!/usr/bin/env python3
"""Block agent edits that introduce constitution WON'T violations.

Port of the Module 1 guard-constitution.mjs hook. Guards tests/, pages/, and
web/cypress/**/*.cy.ts and *.cy.tsx. Also blocks cy.wait(<number>).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

GUARD_FILE_RE = re.compile(
    r"(?:^|/)(?:(?:tests|pages)/.*\.(?:tsx?|jsx?)|web/cypress/.*\.cy\.tsx?)$",
    re.IGNORECASE,
)
SPEC_FILE_RE = re.compile(
    r"(?:^|/)(?:tests/.*\.(?:spec|test)\.[jt]sx?|web/cypress/.*\.cy\.tsx?)$",
    re.IGNORECASE,
)


def count_matches(pattern: str, content: str, flags: int = 0) -> int:
    return len(re.findall(pattern, content, flags))


def count_any(content: str) -> int:
    return (
        count_matches(r":\s*any\b", content)
        + count_matches(r"\bas\s+any\b", content)
        + count_matches(r"<any>", content)
        + count_matches(r"Array<any>", content)
    )


VIOLATION_RULES = [
    {
        "reason": "uses .waitForTimeout( — use web-first expect() instead",
        "count": lambda content: count_matches(r"\.waitForTimeout\s*\(", content),
    },
    {
        "reason": "uses cy.wait(<number>) — wait for an alias or for what the user sees",
        "count": lambda content: count_matches(r"cy\.wait\s*\(\s*\d", content),
    },
    {
        "reason": "uses XPath locator (locator('//…')) — use role/label/text locators",
        "count": lambda content: count_matches(r"\.locator\s*\(\s*['\"`]//", content),
    },
    {
        "reason": "uses the any type — avoid : any, as any, <any>, Array<any>",
        "count": count_any,
    },
    {
        "reason": "hardcoded credential in .fill() with a literal email",
        "count": lambda content: count_matches(
            r"\.fill\s*\(\s*['\"][^'\"]*@[^'\"]*['\"]",
            content,
            re.IGNORECASE,
        ),
    },
    {
        "reason": (
            "hardcoded secret — password/secret/api_key/token assigned a literal "
            "string (4+ chars)"
        ),
        "count": lambda content: count_matches(
            r"(?:password|secret|api_key|token)\s*[=:]\s*['\"][^'\"]{4,}['\"]",
            content,
            re.IGNORECASE,
        ),
    },
    {
        "reason": "tag on test.describe() — tags belong on individual test() blocks only",
        "count": lambda content: count_matches(
            r"test\.describe\s*\([\s\S]*?\{\s*tag\s*:",
            content,
        ),
    },
]


def read_hook_input() -> dict:
    raw_bytes = sys.stdin.buffer.read()
    if raw_bytes.startswith((b"\xff\xfe", b"\xfe\xff")):
        raw = raw_bytes.decode("utf-16")
    else:
        raw = raw_bytes.decode("utf-8-sig")
    if not raw.strip():
        print("guard-constitution: empty stdin", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"guard-constitution: invalid JSON — {exc}", file=sys.stderr)
        sys.exit(1)


def normalize_hook_context(payload: dict) -> tuple[str, str | None, list]:
    event = payload.get("hook_event_name") or "afterFileEdit"
    if event == "preToolUse":
        tool_input = payload.get("tool_input") or {}
        file_path = (
            tool_input.get("path")
            or tool_input.get("file_path")
            or tool_input.get("filePath")
            or payload.get("file_path")
        )
        if not file_path:
            return event, None, []
        if "old_string" in tool_input or "new_string" in tool_input:
            return (
                event,
                file_path,
                [
                    {
                        "old_string": tool_input.get("old_string") or "",
                        "new_string": tool_input.get("new_string") or "",
                    }
                ],
            )
        content = tool_input.get("content")
        contents = tool_input.get("contents")
        if isinstance(content, str) or isinstance(contents, str):
            return (
                event,
                file_path,
                [
                    {
                        "old_string": "",
                        "new_string": content if isinstance(content, str) else contents,
                        "fullReplace": True,
                    }
                ],
            )
        return event, file_path, []

    return event, payload.get("file_path"), payload.get("edits") or []


def apply_edits_to_content(content: str, edits: list) -> str | None:
    next_content = content
    for edit in edits:
        if not isinstance(edit, dict):
            continue
        old_string = edit.get("old_string") or ""
        new_string = edit.get("new_string") or ""
        if edit.get("fullReplace"):
            next_content = new_string
            continue
        if old_string not in next_content:
            return None
        next_content = next_content.replace(old_string, new_string, 1)
    return next_content


def normalize_path(file_path: str) -> str:
    return file_path.replace("\\", "/")


def is_guarded_file(file_path: str) -> bool:
    return bool(GUARD_FILE_RE.search(normalize_path(file_path)))


def is_spec_file(file_path: str) -> bool:
    return bool(SPEC_FILE_RE.search(normalize_path(file_path)))


def count_active_expects(content: str) -> int:
    total = 0
    for line in content.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        code_part = line.split("//", 1)[0]
        total += code_part.count("expect(")
    return total


def reconstruct_before(after_content: str, edits: list) -> str | None:
    content = after_content
    for edit in reversed(edits):
        if not isinstance(edit, dict):
            return None
        if "old_string" not in edit or "new_string" not in edit:
            return None
        old_string = edit.get("old_string")
        new_string = edit.get("new_string")
        if old_string is None or new_string is None:
            return None
        if new_string not in content:
            return None
        content = content.replace(new_string, old_string, 1)
    return content


def new_violation_reasons(before_content: str, after_content: str) -> list[str]:
    reasons = []
    for rule in VIOLATION_RULES:
        if rule["count"](after_content) > rule["count"](before_content):
            reasons.append(rule["reason"])
    return reasons


def new_violations_from_edits(edits: list) -> list[str]:
    reasons: set[str] = set()
    for edit in edits:
        if not isinstance(edit, dict):
            continue
        old_s = edit.get("old_string") or ""
        new_s = edit.get("new_string") or ""
        for rule in VIOLATION_RULES:
            if rule["count"](new_s) > rule["count"](old_s):
                reasons.add(rule["reason"])
    return list(reasons)


def block_message(file_path: str, reasons: list[str], expect_detail: str | None) -> str:
    parts = [f"Blocked: constitution violation in {file_path}"]
    if reasons:
        parts.append("; ".join(reasons))
    if expect_detail:
        parts.append(expect_detail)
    return " — ".join(parts)


def allow(event: str, file_path: str | None) -> None:
    if event == "preToolUse":
        print(json.dumps({"permission": "allow"}))
    if file_path:
        print(f"guard-constitution: OK — {file_path}", file=sys.stderr)
    sys.exit(0)


def deny(event: str, msg: str) -> None:
    body = {"user_message": msg, "agent_message": msg}
    if event == "preToolUse":
        print(json.dumps({"permission": "deny", **body}))
    else:
        print(json.dumps(body))
    print(msg, file=sys.stderr)
    sys.exit(2)


def main() -> None:
    payload = read_hook_input()
    event, file_path, edits = normalize_hook_context(payload)
    if not file_path:
        allow(event, None)

    if not is_guarded_file(file_path):
        allow(event, file_path)

    path = Path(file_path)
    on_disk = path.read_text(encoding="utf-8") if path.is_file() else ""

    reconstruction_failed = False
    if event == "preToolUse":
        before_content = on_disk
        projected = apply_edits_to_content(on_disk, edits)
        if projected is None:
            reconstruction_failed = True
            after_content = on_disk
        else:
            after_content = projected
    else:
        if not path.is_file():
            print(f"guard-constitution: file not found — {file_path}", file=sys.stderr)
            sys.exit(1)
        after_content = on_disk
        before_content = reconstruct_before(after_content, edits)
        if before_content is None:
            reconstruction_failed = True

    reasons = (
        new_violations_from_edits(edits)
        if reconstruction_failed
        else new_violation_reasons(before_content or "", after_content)
    )

    expect_detail = None
    if is_spec_file(file_path) and not reconstruction_failed:
        before_expect = count_active_expects(before_content or "")
        after_expect = count_active_expects(after_content)
        if before_expect > after_expect:
            expect_detail = (
                f"active expect( count {before_expect} -> {after_expect} — "
                "do not delete or weaken assertions"
            )
    elif is_spec_file(file_path) and reconstruction_failed:
        delta = 0
        for edit in edits:
            if not isinstance(edit, dict):
                continue
            old_s = edit.get("old_string") or ""
            new_s = edit.get("new_string") or ""
            delta += count_active_expects(old_s) - count_active_expects(new_s)
        if delta > 0:
            after_expect = count_active_expects(after_content)
            before_expect = after_expect + delta
            expect_detail = (
                f"active expect( count {before_expect} -> {after_expect} — "
                "do not delete or weaken assertions"
            )

    if reasons or expect_detail:
        deny(event, block_message(file_path, reasons, expect_detail))

    allow(event, file_path)


if __name__ == "__main__":
    main()
