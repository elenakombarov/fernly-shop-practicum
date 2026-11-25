#!/usr/bin/env bash
# Offline proof that pipeline gates still hold. No API key, no GitHub network.
# One PASS/FAIL line per check. Exit 1 if any gate fails.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Prefer a real Python 3 (skip Windows Store stubs).
PYTHON=""
if [ -f "$ROOT/.cursor/hooks/resolve-python.sh" ]; then
  # shellcheck source=../.cursor/hooks/resolve-python.sh
  source "$ROOT/.cursor/hooks/resolve-python.sh"
  PYTHON="$(resolve_python 2>/dev/null || true)"
fi
if [ -z "$PYTHON" ]; then
  echo "FAIL  python3 required for hook samples" >&2
  exit 1
fi

pass=0
fail=0

pass_line() {
  echo "PASS  $1"
  pass=$((pass + 1))
}

fail_line() {
  echo "FAIL  $1"
  fail=$((fail + 1))
}

check() {
  # check "name" expect_status command...
  name=$1
  expect=$2
  shift 2
  set +e
  "$@" >/tmp/test-gates-out.txt 2>/tmp/test-gates-err.txt
  status=$?
  set -e
  if [ "$status" -eq "$expect" ]; then
    pass_line "$name"
  else
    fail_line "$name (exit $status, expected $expect)"
  fi
}

hook_perm() {
  # hook_perm expect_perm hook_script json_payload
  expect=$1
  hook=$2
  payload=$3
  set +e
  out=$(printf '%s' "$payload" | bash "$hook" 2>/tmp/test-gates-hook-err.txt)
  status=$?
  set -e
  perm=$(printf '%s' "$out" | "$PYTHON" -c 'import json,sys
raw=sys.stdin.read().strip().splitlines()
perm="missing"
for line in raw:
  line=line.strip()
  if not line.startswith("{"):
    continue
  try:
    perm=json.loads(line).get("permission","?")
  except Exception:
    continue
print(perm)' 2>/dev/null || echo "?")
  if [ "$perm" = "$expect" ]; then
    return 0
  fi
  # Constitution / assertion hooks may deny with exit 2 and a Blocked message.
  if [ "$expect" = "deny" ] && [ "$status" -eq 2 ]; then
    if printf '%s\n' "$out" | grep -q '"permission": "deny"\|Blocked:'; then
      return 0
    fi
    if grep -q 'Blocked:' /tmp/test-gates-hook-err.txt 2>/dev/null; then
      return 0
    fi
  fi
  if [ "$expect" = "allow" ] && [ "$status" -eq 0 ]; then
    if [ "$perm" = "allow" ] || [ "$perm" = "missing" ]; then
      # afterFileEdit-style allow may print nothing on stdout
      if ! grep -qi 'Blocked:' /tmp/test-gates-hook-err.txt 2>/dev/null; then
        return 0
      fi
    fi
  fi
  echo "  got permission=$perm exit=$status out=$out" >&2
  sed 's/^/  stderr: /' /tmp/test-gates-hook-err.txt >&2 || true
  return 1
}

# ---------------------------------------------------------------------------
# agent-guard — patches from a throwaway worktree (never touch the checkout)
# ---------------------------------------------------------------------------
WT=$(mktemp -d "${TMPDIR:-/tmp}/fernly-gates.XXXXXX")
cleanup() {
  git worktree remove --force "$WT" 2>/dev/null || true
  rm -rf "$WT"
}
trap cleanup EXIT

git worktree add --detach "$WT" HEAD >/dev/null 2>&1
git -C "$WT" config user.email "gates@example.com"
git -C "$WT" config user.name "gates"

make_patch() {
  # make_patch <name> <paths...>  — commit changes in worktree, write patch file
  name=$1
  shift
  patch="$WT/${name}.patch"
  git -C "$WT" reset --hard HEAD >/dev/null 2>&1
  git -C "$WT" clean -fd >/dev/null 2>&1
  for rel in "$@"; do
    dir=$(dirname "$rel")
    mkdir -p "$WT/$dir"
    printf '%s\n' "gates-probe ${name}" >>"$WT/$rel"
  done
  git -C "$WT" add -- "$@"
  git -C "$WT" commit -m "gates ${name}" >/dev/null 2>&1
  git -C "$WT" format-patch -1 --stdout >"$patch"
  printf '%s' "$patch"
}

# plan only → allowed
P_PLAN=$(make_patch plan-only docs/test-plans/gates-probe.md)
check "agent-guard: plan only allowed" 0 \
  bash scripts/agent-guard.sh "$P_PLAN" 'docs/test-plans/*'

# plan + web/src → blocked
P_WEB=$(make_patch plan-plus-web docs/test-plans/gates-probe.md web/src/gates-probe.ts)
check "agent-guard: plan plus web/src blocked" 1 \
  bash scripts/agent-guard.sh "$P_WEB" 'docs/test-plans/*'

# workflow change → blocked
P_WF=$(make_patch workflow .github/workflows/gates-probe.yml)
check "agent-guard: workflow change blocked" 1 \
  bash scripts/agent-guard.sh "$P_WF" 'docs/test-plans/*' '.github/workflows/*'

# screenshot baseline (*-snapshots) → blocked
P_SNAP=$(make_patch snapshot 'tests/visual/gates-probe-snapshots/baseline.png')
check "agent-guard: screenshot baseline blocked" 1 \
  bash scripts/agent-guard.sh "$P_SNAP" 'tests/*'

# agent-guard.sh itself blocked even with scripts/* allowed
P_SELF=$(make_patch self-guard scripts/agent-guard.sh)
check "agent-guard: scripts/agent-guard.sh blocked even with scripts/*" 1 \
  bash scripts/agent-guard.sh "$P_SELF" 'scripts/*'

# new tests + FINDINGS.md → allowed
P_TESTS=$(make_patch tests-findings tests/api/gates-probe.spec.ts FINDINGS.md)
check "agent-guard: tests and FINDINGS.md allowed" 0 \
  bash scripts/agent-guard.sh "$P_TESTS" 'tests/*' 'FINDINGS.md'

# ---------------------------------------------------------------------------
# capture-plan-patch — plan packaging (incidental lockfile vs unexpected)
# Invoke the ROOT script inside the worktree so uncommitted scripts/ noise
# is not itself treated as an unexpected agent change.
# ---------------------------------------------------------------------------
CAPTURE="$ROOT/scripts/capture-plan-patch.sh"

git -C "$WT" reset --hard HEAD >/dev/null 2>&1
git -C "$WT" clean -fd >/dev/null 2>&1
mkdir -p "$WT/docs/test-plans"
printf '%s\n' '# gates capture plan' >"$WT/docs/test-plans/gates-capture.md"
if (cd "$WT" && bash "$CAPTURE" "$WT/capture-plan-ok.patch") \
  && grep -q 'docs/test-plans/gates-capture.md' "$WT/capture-plan-ok.patch" \
  && ! grep -q 'package-lock\.json' "$WT/capture-plan-ok.patch"; then
  pass_line "capture-plan-patch: valid plan accepted"
else
  fail_line "capture-plan-patch: valid plan accepted"
fi

git -C "$WT" reset --hard HEAD >/dev/null 2>&1
git -C "$WT" clean -fd >/dev/null 2>&1
mkdir -p "$WT/docs/test-plans"
printf '%s\n' '# gates capture plan' >"$WT/docs/test-plans/gates-capture.md"
lock_head=$(git -C "$WT" rev-parse "HEAD:package-lock.json")
printf '\n# gates incidental lock churn\n' >>"$WT/package-lock.json"
if (cd "$WT" && bash "$CAPTURE" "$WT/capture-plan-lock.patch") \
  && [ "$(git -C "$WT" hash-object package-lock.json)" = "$lock_head" ] \
  && git -C "$WT" diff --quiet -- package-lock.json \
  && grep -q 'docs/test-plans/gates-capture.md' "$WT/capture-plan-lock.patch" \
  && ! grep -q 'package-lock\.json' "$WT/capture-plan-lock.patch"; then
  pass_line "capture-plan-patch: incidental package-lock excluded"
else
  fail_line "capture-plan-patch: incidental package-lock excluded"
fi

git -C "$WT" reset --hard HEAD >/dev/null 2>&1
git -C "$WT" clean -fd >/dev/null 2>&1
mkdir -p "$WT/docs/test-plans" "$WT/web/src"
printf '%s\n' '# gates capture plan' >"$WT/docs/test-plans/gates-capture.md"
printf '%s\n' '// unexpected' >"$WT/web/src/gates-capture-probe.ts"
if (cd "$WT" && bash "$CAPTURE" "$WT/capture-plan-bad.patch"); then
  fail_line "capture-plan-patch: unexpected app change rejected"
else
  pass_line "capture-plan-patch: unexpected app change rejected"
fi

git -C "$WT" reset --hard HEAD >/dev/null 2>&1
git -C "$WT" clean -fd >/dev/null 2>&1
mkdir -p "$WT/docs/test-plans" "$WT/.github/workflows"
printf '%s\n' '# gates capture plan' >"$WT/docs/test-plans/gates-capture.md"
printf '%s\n' 'name: gates-probe' >"$WT/.github/workflows/gates-capture-probe.yml"
if (cd "$WT" && bash "$CAPTURE" "$WT/capture-plan-wf.patch"); then
  fail_line "capture-plan-patch: unexpected workflow change rejected"
else
  pass_line "capture-plan-patch: unexpected workflow change rejected"
fi

# ---------------------------------------------------------------------------
# hooks — P81 (guard-approvals) and P77 (constitution + assertion)
# ---------------------------------------------------------------------------
APPROVALS=.cursor/hooks/guard-approvals.sh
CONSTITUTION=.cursor/hooks/guard-constitution.sh
ASSERTIONS=.cursor/hooks/guard-test-assertions.sh

payload_cmd() {
  "$PYTHON" -c 'import json,sys; print(json.dumps({"command": sys.argv[1]}))' "$1"
}

if hook_perm deny "$APPROVALS" "$(payload_cmd 'gh pr edit 7 --add-label plan-approved')"; then
  pass_line "hook approvals: label denied"
else
  fail_line "hook approvals: label denied"
fi
if hook_perm deny "$APPROVALS" "$(payload_cmd 'gh pr merge 7 --squash')"; then
  pass_line "hook approvals: merge denied"
else
  fail_line "hook approvals: merge denied"
fi
if hook_perm deny "$APPROVALS" "$(payload_cmd 'gh pr review 7 --approve -b ok')"; then
  pass_line "hook approvals: approve denied"
else
  fail_line "hook approvals: approve denied"
fi
if hook_perm deny "$APPROVALS" "$(payload_cmd 'printenv')"; then
  pass_line "hook approvals: printenv denied"
else
  fail_line "hook approvals: printenv denied"
fi
if hook_perm allow "$APPROVALS" "$(payload_cmd 'gh pr view 7')"; then
  pass_line "hook approvals: gh pr view allowed"
else
  fail_line "hook approvals: gh pr view allowed"
fi
if hook_perm allow "$APPROVALS" "$(payload_cmd 'git diff origin/init...HEAD')"; then
  pass_line "hook approvals: git diff allowed"
else
  fail_line "hook approvals: git diff allowed"
fi

# P77 constitution: deny waitForTimeout; allow a clean locator change
CONST_DENY=$("$PYTHON" -c 'import json; print(json.dumps({
  "hook_event_name": "preToolUse",
  "tool_name": "Write",
  "tool_input": {
    "path": "tests/e2e/gates-probe.spec.ts",
    "old_string": "await page.getByRole(\"button\").click();",
    "new_string": "await page.waitForTimeout(500);\nawait page.getByRole(\"button\").click();"
  }
}))')
CONST_ALLOW=$("$PYTHON" -c 'import json; print(json.dumps({
  "hook_event_name": "preToolUse",
  "tool_name": "Write",
  "tool_input": {
    "path": "tests/e2e/gates-probe.spec.ts",
    "old_string": "await page.getByRole(\"button\").click();",
    "new_string": "await page.getByRole(\"button\", { name: \"Save\" }).click();"
  }
}))')

# Seed a temp file the hooks can project against (path as given; may be relative).
mkdir -p tests/e2e
PROBE=tests/e2e/gates-probe.spec.ts
printf '%s\n' 'await page.getByRole("button").click();' >"$PROBE"
# Keep the probe out of the user's tree after the run.
trap 'rm -f tests/e2e/gates-probe.spec.ts; cleanup' EXIT

if hook_perm deny "$CONSTITUTION" "$CONST_DENY"; then
  pass_line "hook constitution: waitForTimeout denied"
else
  fail_line "hook constitution: waitForTimeout denied"
fi
if hook_perm allow "$CONSTITUTION" "$CONST_ALLOW"; then
  pass_line "hook constitution: clean edit allowed"
else
  fail_line "hook constitution: clean edit allowed"
fi

# P77 assertions: deny removing expect(; allow keeping it
printf '%s\n' 'expect(page.getByRole("button")).toBeVisible();' >"$PROBE"
ASSERT_DENY=$("$PYTHON" -c 'import json; print(json.dumps({
  "hook_event_name": "preToolUse",
  "tool_name": "Write",
  "tool_input": {
    "path": "tests/e2e/gates-probe.spec.ts",
    "old_string": "expect(page.getByRole(\"button\")).toBeVisible();",
    "new_string": "// expect(page.getByRole(\"button\")).toBeVisible();"
  }
}))')
ASSERT_ALLOW=$("$PYTHON" -c 'import json; print(json.dumps({
  "hook_event_name": "preToolUse",
  "tool_name": "Write",
  "tool_input": {
    "path": "tests/e2e/gates-probe.spec.ts",
    "old_string": "expect(page.getByRole(\"button\")).toBeVisible();",
    "new_string": "await expect(page.getByRole(\"button\")).toBeVisible();"
  }
}))')

if hook_perm deny "$ASSERTIONS" "$ASSERT_DENY"; then
  pass_line "hook assertions: weakened expect denied"
else
  fail_line "hook assertions: weakened expect denied"
fi
if hook_perm allow "$ASSERTIONS" "$ASSERT_ALLOW"; then
  pass_line "hook assertions: preserved expect allowed"
else
  fail_line "hook assertions: preserved expect allowed"
fi

rm -f "$PROBE"

# ---------------------------------------------------------------------------
# workflows — grep/awk only
# ---------------------------------------------------------------------------
WF_TRIAGE=.github/workflows/pr-triage.yml
WF_TESTS=.github/workflows/tests.yml

# No pull_request_target trigger (comments don't count)
if grep -v '[[:space:]]*#' "$WF_TRIAGE" "$WF_TESTS" .github/workflows/*.yml 2>/dev/null \
  | grep -E '^[[:space:]]*pull_request_target[[:space:]]*:' >/dev/null; then
  fail_line "workflows: no pull_request_target trigger"
else
  pass_line "workflows: no pull_request_target trigger"
fi

# Every pr-triage job has timeout-minutes
job_without_timeout=$(awk '
  /^jobs:[[:space:]]*$/ { in_jobs=1; next }
  in_jobs && /^[^[:space:]#]/ { in_jobs=0 }
  in_jobs && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ {
    if (job != "" && seen_timeout == 0) print job
    job=$1; sub(/:$/, "", job); seen_timeout=0
  }
  in_jobs && /^    timeout-minutes:[[:space:]]*[0-9]+/ { seen_timeout=1 }
  END { if (job != "" && seen_timeout == 0) print job }
' "$WF_TRIAGE")
if [ -z "$job_without_timeout" ]; then
  pass_line "workflows: every pr-triage job has timeout-minutes"
else
  fail_line "workflows: every pr-triage job has timeout-minutes (missing: $job_without_timeout)"
fi

# Agent-running steps never get GH_TOKEN / GITHUB_TOKEN; checkouts persist-credentials: false
# Detect agent steps: name contains "agent" and following env/run until next "- name:"
agent_token_leak=$(awk '
  /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { job=$1; sub(/:$/, "", job) }
  /^      - name:/ {
    name=$0
    in_agent=0
    if (tolower(name) ~ /agent/) in_agent=1
    in_env=0
  }
  in_agent && /^        env:[[:space:]]*$/ { in_env=1; next }
  in_agent && in_env && /^        [A-Za-z]/ { in_env=0 }
  in_agent && in_env && /GH_TOKEN:|GITHUB_TOKEN:/ {
    print job ":" name
  }
' "$WF_TRIAGE")
if [ -z "$agent_token_leak" ]; then
  pass_line "workflows: agent steps have no GH_TOKEN or GITHUB_TOKEN"
else
  fail_line "workflows: agent steps have no GH_TOKEN or GITHUB_TOKEN ($agent_token_leak)"
fi

# Checkouts in plan and tests jobs: persist-credentials: false
missing_persist=$(awk '
  /^  [A-Za-z0-9_-]+:[[:space:]]*$/ {
    job=$1; sub(/:$/, "", job)
  }
  job == "plan" || job == "tests" {
    if ($0 ~ /uses:[[:space:]]*actions\/checkout/) { in_co=1; saw=0; next }
    if (in_co && /^      - /) { if (!saw) print job; in_co=0 }
    if (in_co && /persist-credentials:[[:space:]]*false/) saw=1
    if (in_co && /^  [A-Za-z]/ && !/^    /) { if (!saw) print job; in_co=0 }
  }
  END { if (in_co && !saw) print job }
' "$WF_TRIAGE")
# Simpler explicit grep for the two agent jobs' checkouts
plan_persist=$(awk '
  /^  plan:[[:space:]]*$/ { injob=1; next }
  /^  [A-Za-z]/ { if (injob && $0 !~ /^  plan:/) injob=0 }
  injob && /persist-credentials:[[:space:]]*false/ { print; exit }
' "$WF_TRIAGE")
tests_persist=$(awk '
  /^  tests:[[:space:]]*$/ { injob=1; next }
  /^  [A-Za-z]/ { if (injob && $0 !~ /^  tests:/) injob=0 }
  injob && /persist-credentials:[[:space:]]*false/ { print; exit }
' "$WF_TRIAGE")
if [ -n "$plan_persist" ] && [ -n "$tests_persist" ]; then
  pass_line "workflows: agent job checkouts set persist-credentials false"
else
  fail_line "workflows: agent job checkouts set persist-credentials false"
fi

# tests job starts only when a person adds plan-approved
tests_if=$(awk '
  /^  tests:[[:space:]]*$/ { injob=1; next }
  /^  [A-Za-z]/ { if (injob && $0 !~ /^  tests:/) injob=0 }
  injob && /^    if:/ { print; exit }
' "$WF_TRIAGE")
if printf '%s' "$tests_if" | grep -q "plan-approved" \
  && printf '%s' "$tests_if" | grep -q "github.event.sender.type == 'User'"; then
  pass_line "workflows: tests job needs plan-approved by a person"
else
  fail_line "workflows: tests job needs plan-approved by a person"
fi

echo
if [ "$fail" -gt 0 ]; then
  echo "Gates: $pass passed, $fail failed"
  exit 1
fi
echo "Gates: $pass passed, 0 failed"
exit 0
