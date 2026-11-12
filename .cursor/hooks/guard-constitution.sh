#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=resolve-python.sh
source "${SCRIPT_DIR}/resolve-python.sh"
PYTHON="$(resolve_python)" || {
  echo "guard-constitution: no working Python 3 found" >&2
  exit 1
}
exec "$PYTHON" "${SCRIPT_DIR}/guard-constitution.py"
