#!/usr/bin/env bash
# Run the Cursor agent in print mode, keep every stream-json event, log each
# tool call as it starts (so a stuck command is the last line), and write only
# the agent's last assistant message to the result file.
# Usage: run-agent.sh <prompt-file> <result-file> <trail-file>
set -euo pipefail

usage() {
  echo "usage: run-agent.sh <prompt-file> <result-file> <trail-file>" >&2
  exit 2
}

[ "$#" -eq 3 ] || usage

prompt_file=$1
result_file=$2
trail_file=$3

if [ ! -f "$prompt_file" ]; then
  echo "run-agent: prompt not found: $prompt_file" >&2
  exit 1
fi

if ! command -v agent >/dev/null 2>&1; then
  echo "run-agent: agent not on PATH" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "run-agent: jq is required" >&2
  exit 1
fi

# The agent must not see repo tokens even if the caller left them set.
unset GITHUB_TOKEN GH_TOKEN GH_REPO || true

: >"$trail_file"
: >"$result_file"
last_msg_file=$(mktemp)
trap 'rm -f "$last_msg_file"' EXIT
: >"$last_msg_file"

prompt=$(cat "$prompt_file")

# Stream events: append every line to the trail; print one line per started tool.
set +e
agent -p --force --trust --output-format stream-json -- "$prompt" | while IFS= read -r line || [ -n "$line" ]; do
  printf '%s\n' "$line" >>"$trail_file"

  type=$(printf '%s\n' "$line" | jq -r '.type // empty' 2>/dev/null) || continue

  case "$type" in
    tool_call)
      subtype=$(printf '%s\n' "$line" | jq -r '.subtype // empty')
      if [ "$subtype" = "started" ]; then
        summary=$(printf '%s\n' "$line" | jq -r '
          .tool_call
          | to_entries[0]
          | .key as $k
          | .value.args as $a
          | ($a.command // $a.path // $a.pattern // $a.query // $a.url // "") as $detail
          | if ($detail | length) > 0 then "\($k) \($detail)" else $k end
        ' 2>/dev/null || printf '%s\n' "tool_call")
        printf 'agent tool: %s\n' "$summary"
      fi
      ;;
    assistant)
      text=$(printf '%s\n' "$line" | jq -r '
        [.message.content[]? | select(.type == "text") | .text] | join("")
      ' 2>/dev/null || true)
      if [ -n "${text:-}" ]; then
        printf '%s' "$text" >"$last_msg_file"
      fi
      ;;
  esac
done
agent_status=${PIPESTATUS[0]}
set -e

if [ -s "$last_msg_file" ]; then
  cat "$last_msg_file" >"$result_file"
  # Ensure the comment body ends with a newline.
  case "$(tail -c 1 "$result_file" | wc -l)" in
    0) echo >>"$result_file" ;;
  esac
fi

exit "$agent_status"
