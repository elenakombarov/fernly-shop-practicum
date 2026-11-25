#!/usr/bin/env bash
# Print one Python 3 that can import json. Skip the Windows Store alias named python3.

resolve_python() {
  local candidate resolved path
  for candidate in python3 python py; do
    resolved="$(command -v "$candidate" 2>/dev/null || true)"
    [ -n "$resolved" ] || continue
    case "$resolved" in
      *[Ww]indows[Aa]pps*) continue ;;
    esac
    if "$resolved" -c 'import json,sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
      printf '%s\n' "$resolved"
      return 0
    fi
  done

  for path in \
    "/c/Program Files/LibreOffice/program/python.exe" \
    "/c/Program Files/Python313/python.exe" \
    "/c/Program Files/Python312/python.exe" \
    "/c/Program Files/Python311/python.exe"
  do
    if [ -f "$path" ] && "$path" -c 'import json,sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
      printf '%s\n' "$path"
      return 0
    fi
  done
  return 1
}
