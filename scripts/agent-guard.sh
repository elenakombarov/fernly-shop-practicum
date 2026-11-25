#!/usr/bin/env bash
# Refuse a patch that touches files outside the allow-list, or that only a
# person may change. Bash 3.2 compatible. Empty patch is fine.
set -euo pipefail

usage() {
  echo "usage: agent-guard.sh <patch> <allowed pattern>..." >&2
  exit 2
}

[ "$#" -ge 1 ] || usage

patch=$1
shift

if [ ! -f "$patch" ]; then
  echo "agent-guard: patch not found: $patch" >&2
  exit 1
fi

# Empty patch: nothing to reject.
if [ ! -s "$patch" ]; then
  exit 0
fi

is_person_only() {
  path=$1
  base=${path##*/}

  case "$path" in
    web/src|web/src/*|api/src|api/src/*) return 0 ;;
    .github|.github/*|.cursor|.cursor/*|scripts|scripts/*) return 0 ;;
    web/cypress.config.ts) return 0 ;;
    web/cypress/screenshots|web/cypress/screenshots/*) return 0 ;;
    web/cypress/results|web/cypress/results/*) return 0 ;;
    web/cypress/videos|web/cypress/videos/*) return 0 ;;
    .env|.env.*|*/.env|*/.env.*) return 0 ;;
  esac

  case "$base" in
    package.json|package-lock.json|playwright.config.ts|a11y-baseline.json) return 0 ;;
    .env|.env.*) return 0 ;;
  esac

  # Any *-snapshots/ directory segment (visual baselines, etc.).
  rest=$path
  while [ -n "$rest" ]; do
    seg=${rest%%/*}
    if [ "$seg" = "$rest" ]; then
      rest=
    else
      rest=${rest#*/}
    fi
    case "$seg" in
      *-snapshots) return 0 ;;
    esac
  done

  return 1
}

# True when $1 contains a glob metacharacter (*, ?, or [).
has_glob_meta() {
  case "$1" in
    *'*'*|*'?'*|*'['*) return 0 ;;
  esac
  return 1
}

# Path may not use .. to climb out of an allowed prefix.
path_has_dotdot() {
  case "$1" in
    ..|../*|*/..|*/../*) return 0 ;;
  esac
  return 1
}

matches_allowed() {
  path=$1
  shift
  for pat in "$@"; do
    case "$pat" in
      */)
        # Explicit directory allow (no '*', so MSYS will not expand it):
        # docs/test-plans/ permits only that directory tree.
        dir=${pat%/}
        if path_has_dotdot "$path"; then
          continue
        fi
        case "$path" in
          "$dir"|"$dir"/*) return 0 ;;
        esac
        ;;
      *)
        if has_glob_meta "$pat"; then
          # Glob allow: only paths that match this pattern.
          case "$path" in
            $pat) return 0 ;;
          esac
        elif [ "$path" = "$pat" ]; then
          # Exact allow: only this file. Never a parent-directory fallback.
          return 0
        fi
        ;;
    esac
  done
  return 1
}

rejected=""
rejected_count=0

# git apply --numstat prints: added<TAB>deleted<TAB>path
# Read path as field 3 onward so names with spaces still work.
while IFS= read -r line || [ -n "$line" ]; do
  # Drop CR so Windows git numstat lines still match Unix allow patterns.
  line=$(printf '%s' "$line" | tr -d '\r')
  [ -n "$line" ] || continue
  path=$(printf '%s\n' "$line" | cut -f3-)
  [ -n "$path" ] || continue

  bad=0
  if is_person_only "$path"; then
    bad=1
  elif [ "$#" -eq 0 ]; then
    bad=1
  elif ! matches_allowed "$path" "$@"; then
    bad=1
  fi

  if [ "$bad" -eq 1 ]; then
    rejected="${rejected}${path}"$'\n'
    rejected_count=$((rejected_count + 1))
  fi
done <<EOF
$(git apply --numstat -- "$patch")
EOF

if [ "$rejected_count" -gt 0 ]; then
  echo "agent-guard: refusing files outside the allow-list or reserved for people:" >&2
  printf '%s' "$rejected" >&2
  exit 1
fi

exit 0
