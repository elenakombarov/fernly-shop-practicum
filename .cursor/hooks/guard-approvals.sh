#!/usr/bin/env bash
# beforeShellExecution: only a person merges, approves, labels, or reads tokens.
# Pure bash (3.2+). Reads hook JSON on stdin; always prints permission JSON.
set -euo pipefail

deny() {
  # Escape reason for JSON string (backslash and double-quote).
  reason=$1
  escaped=$(printf '%s' "Only a person does this: ${reason}" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '%s\n' "{\"permission\":\"deny\",\"user_message\":\"${escaped}\",\"agent_message\":\"${escaped}\"}"
  exit 0
}

allow() {
  printf '%s\n' '{"permission":"allow"}'
  exit 0
}

input=$(cat || true)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command=""
PYTHON=""
if [ -f "${SCRIPT_DIR}/resolve-python.sh" ]; then
  # shellcheck source=resolve-python.sh
  source "${SCRIPT_DIR}/resolve-python.sh"
  PYTHON="$(resolve_python 2>/dev/null || true)"
fi
if [ -n "$PYTHON" ]; then
  command=$(printf '%s' "$input" | "$PYTHON" -c 'import json,sys
try:
    print(json.load(sys.stdin).get("command") or "")
except Exception:
    print("")' 2>/dev/null || true)
fi
if [ -z "$command" ] && [ -n "$input" ]; then
  # Best-effort: first "command":"..." value (commands with quotes may truncate).
  command=$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
  command=$(printf '%s' "$command" | sed 's/\\n/ /g; s/\\"/"/g; s/\\\\/\\/g')
fi

cmd=$(printf '%s' "$command" | tr '\n\r' '  ')

# --- secrets ---
if printf '%s' "$cmd" | grep -Eq '\$\{?(CURSOR_API_KEY|GH_TOKEN|GITHUB_TOKEN)([:}[:space:]"/]|$)'; then
  deny "reading CURSOR_API_KEY, GH_TOKEN, or GITHUB_TOKEN"
fi

# printenv as a command word
if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]|&;])printenv([[:space:]|&;]|$)'; then
  deny "printenv"
fi

# env on its own (dumps the environment). Allow "env VAR=x cmd" / "env -i cmd".
# A list/pipeline segment that is only env + options/assignments is denied.
if printf '%s' "$cmd" | grep -Eq '(^|[;&|])[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*env([[:space:]]+(-[^[:space:]]+|[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*))*[[:space:]]*$' \
  || printf '%s' "$cmd" | grep -Eq '^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*env([[:space:]]+(-[^[:space:]]+|[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*))*[[:space:]]*$'; then
  deny "env"
fi

# --- gh: merge, approve, labels ---
if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]|&;])gh([[:space:]|&;]|$)'; then
  if printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+merge([[:space:]|&;]|$)'; then
    deny "gh pr merge"
  fi

  if printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+review\b' \
    && printf '%s' "$cmd" | grep -Eq -- '--approve([[:space:]|=]|$)'; then
    deny "gh pr review --approve"
  fi

  if printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+edit\b' \
    && printf '%s' "$cmd" | grep -Eq -- '--add-label([[:space:]|=]|$)'; then
    deny "gh pr edit --add-label"
  fi

  if printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+issue[[:space:]]+edit\b' \
    && printf '%s' "$cmd" | grep -Eq -- '--add-label([[:space:]|=]|$)'; then
    deny "gh issue edit --add-label"
  fi

  if printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+label([[:space:]|&;]|$)'; then
    deny "gh label"
  fi

  if printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+api\b'; then
    if printf '%s' "$cmd" | grep -Eq '/labels([[:space:]"?|&;]|$)'; then
      deny "gh api labels"
    fi
    if printf '%s' "$cmd" | grep -Ei '/merges?([[:space:]"?|&;]|$)'; then
      deny "gh api merge"
    fi
    if printf '%s' "$cmd" | grep -Eq '/reviews([[:space:]"?|&;]|$)'; then
      deny "gh api review"
    fi
  fi
fi

allow
