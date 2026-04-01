# AI Collaboration Workflow

This repo is set up for a simple three-way workflow:

- User: owns the goal, reviews the result, and decides when it is ready.
- Codex: makes the actual repo changes when we are editing files.
- Claude: runs as a local Ollama-backed assistant for planning, review, and parallel agent work.

The rule that keeps this stable is simple: one agent owns one file at a time. If two agents need the same area, one of them stays in read-only mode until the other finishes.

## Files In This Setup

- `scripts/launch-claude-ollama.sh`: launches Claude Code against a local Ollama endpoint.
- `docs/claude-agents.json`: agent definitions for `claude --agents`.
- `docs/ai-collaboration-workflow.md`: this guide.

## One-Time macOS Setup

1. Make sure Ollama is running.

```bash
ollama serve
```

If you already run Ollama as a background app, you can skip that terminal.

2. Pull a local model you want to use.

```bash
ollama pull qwen3
```

If you prefer a different local model, set `OLLAMA_MODEL` before launching Claude.

3. Make the launcher executable.

```bash
chmod +x scripts/launch-claude-ollama.sh
```

4. Start Claude Code in local mode.

```bash
./scripts/launch-claude-ollama.sh
```

To use a different Ollama model for the session:

```bash
OLLAMA_MODEL=qwen3.5 ./scripts/launch-claude-ollama.sh
```

## Agent Team

Use the agent names in `docs/claude-agents.json` when you want Claude to split work by role:

- `architect`: plans and sequences the work before edits.
- `frontend`: handles UI, CSS, and client-side behavior.
- `backend`: handles routes, controllers, APIs, and database changes.
- `qa`: checks for regressions and test coverage gaps.
- `security`: checks for secrets, injection, and unsafe command usage.
- `pm`: keeps scope tight and acceptance criteria clear.

The launcher passes this JSON to Claude automatically, so the agents are available as soon as the session starts.

If you want Claude's built-in team orchestration UI, enable it for that session:

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 ./scripts/launch-claude-ollama.sh
```

## No-Merge-Conflict Workflow

Use this sequence whenever the task is bigger than a tiny one-file edit.

1. Start with a clean view of the repo.

```bash
git status --short
git branch --show-current
```

2. Ask Claude to plan first when the task touches multiple areas.

Example prompt:

```text
Use architect first. List the files that should change, the order to edit them, and the risks that could cause merge conflicts.
```

3. Assign file ownership before editing.

- One agent owns one file or one small cluster of related files.
- If a file is already being edited, other agents only read it.
- If you need overlap, split the work by responsibility instead of by timing.

4. Keep edits small and finish one lane before starting the next.

- Frontend changes first if the task is mostly UI.
- Backend changes first if the task is mostly API or data flow.
- QA and security review after the implementation is stable.

5. Use the git diff as the handoff boundary.

```bash
git diff --stat
git diff -- frontend/src/App.js
```

6. Re-check status before the next agent touches anything.

```bash
git status --short
```

7. Commit only after the whole set of changes passes review.

```bash
git add -A
git commit -m "Describe the workflow or feature"
```

## Safe Collaboration Pattern

When Codex and Claude are both helping on the same feature, use this split:

- Claude: explore, plan, summarize, and review.
- Codex: apply the edits and reconcile any conflicts.
- User: approve the direction and decide whether the result is complete.

That division keeps both assistants useful without making them compete over the same file.

## Practical Guardrails

- Never let two agents edit the same file at the same time.
- Prefer one branch per task.
- If a task needs a risky change, let `security` and `qa` review it before merge.
- If you are unsure which agent should own a task, ask `architect` to break it into file-level steps first.

## Example Session

```bash
cd ~/Desktop/aviao
git checkout -b feat/ai-workflow-test
./scripts/launch-claude-ollama.sh
```

Then inside Claude:

```text
Use architect to map the change, then let frontend or backend make the edits, and finish with qa and security review.
```

## Notes For This Repo

- This repository already has mixed frontend and backend code, so keep ownership explicit.
- Docs and scripts for the workflow belong in `docs/` and `scripts/` only.
- If a future task needs app logic changes, keep them separate from the workflow assets so the collaboration setup stays easy to review.

## Inspiration Patterns

This workflow borrows proven ideas from active multi-agent projects:

- OpenHands: end-to-end coding loops with explicit task ownership and tool use.
- MetaGPT: software-company style role split (architect, engineer, reviewer).
- AutoGen: agent conversation patterns where each role has narrow responsibilities.
- SWE-agent: tight plan -> edit -> test -> report cycles for reproducible progress.
