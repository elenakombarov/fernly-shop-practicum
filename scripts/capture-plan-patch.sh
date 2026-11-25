#!/usr/bin/env bash
# Package only the plan agent's docs/test-plans changes into a guarded patch.
# Inspects the worktree first: incidental package-lock.json edits (from npm
# install for OpenAPI) are reported and restored; any other unexpected change
# fails the job. Does not widen agent-guard.
# Usage: capture-plan-patch.sh <agent.patch>
set -euo pipefail

usage() {
  echo "usage: capture-plan-patch.sh <agent.patch>" >&2
  exit 2
}

[ "$#" -eq 1 ] || usage
out=$1

# Honor the caller's worktree (CI cwd, or a gates worktree) when present.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ROOT="$(git rev-parse --show-toplevel)"
else
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi
cd "$ROOT"

# Porcelain path field (strip XY + space; unwrap renames and quotes).
path_from_porcelain() {
  line=$1
  path=${line#???}
  case "$path" in
    *' -> '*) path=${path##* -> } ;;
  esac
  case "$path" in
    \"*)
      path=${path#\"}
      path=${path%\"}
      ;;
  esac
  printf '%s' "$path"
}

unexpected=""
lock_dirty=0

while IFS= read -r line || [ -n "$line" ]; do
  [ -z "$line" ] && continue
  path=$(path_from_porcelain "$line")
  [ -z "$path" ] && continue
  case "$path" in
    docs/test-plans|docs/test-plans/*) ;;
    package-lock.json)
      lock_dirty=1
      ;;
    *)
      unexpected="${unexpected}${path}"$'\n'
      ;;
  esac
done <<EOF
$(git status --porcelain -uall)
EOF

if [ -n "$unexpected" ]; then
  echo "capture-plan-patch: unexpected agent changes (refusing to package):" >&2
  printf '%s' "$unexpected" >&2
  exit 1
fi

if [ "$lock_dirty" -eq 1 ]; then
  echo "capture-plan-patch: incidental package-lock.json modification detected; restoring."
  if git ls-files --error-unmatch package-lock.json >/dev/null 2>&1; then
    git restore --source=HEAD --worktree --staged -- package-lock.json
  else
    rm -f package-lock.json
  fi
fi

# Stage only the intended plan output.
git add -- 'docs/test-plans' 2>/dev/null || true
git diff --cached --binary >"$out"
bash "$ROOT/scripts/agent-guard.sh" "$out" 'docs/test-plans/*'
