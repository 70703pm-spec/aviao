#!/usr/bin/env bash
set -euo pipefail

# Launch Claude Code against Ollama's Anthropic-compatible endpoint.
# Defaults assume Ollama is running on macOS at http://127.0.0.1:11434.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS_FILE="$ROOT_DIR/docs/claude-agents.json"

if ! command -v claude >/dev/null 2>&1; then
  echo "error: claude CLI is not installed or not on PATH" >&2
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "error: ollama is not installed or not on PATH" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "error: curl is not installed or not on PATH" >&2
  exit 1
fi

export OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-${OLLAMA_HOST%/}}"
export ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-ollama}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
export CLAUDE_MODEL="${CLAUDE_MODEL:-${OLLAMA_MODEL:-qwen3}}"

# Claude Code with Ollama expects the Anthropic-compatible root endpoint.
if [[ "$ANTHROPIC_BASE_URL" == */v1 || "$ANTHROPIC_BASE_URL" == */v1/ ]]; then
  ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL%/v1/}"
  ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL%/v1}"
fi

if ! curl -fsS "${OLLAMA_HOST%/}/api/tags" >/dev/null 2>&1; then
  echo "error: Ollama is not responding at ${OLLAMA_HOST}" >&2
  echo "hint: start it with 'ollama serve' or open the Ollama app, then rerun this script" >&2
  exit 1
fi

cd "$ROOT_DIR"

CLAUDE_ARGS=(--model "$CLAUDE_MODEL")

if [[ -f "$AGENTS_FILE" ]]; then
  CLAUDE_ARGS+=(--agents "$(tr -d '\n' < "$AGENTS_FILE")")
fi

exec claude "${CLAUDE_ARGS[@]}" "$@"
