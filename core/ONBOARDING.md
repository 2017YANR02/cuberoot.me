# Welcome to cuberoot.me

## How We Use Codex

Codex is the project's active AI development environment. Claude Code is no longer used.

The repository rules are loaded from the root `AGENTS.md` plus scoped `solver/AGENTS.md`
and `reconer/AGENTS.md`. Reusable project skills live under `.agents/skills/`; global and
project hooks live in `~/.codex/hooks.json` and `.codex/hooks.json`.

## Your Setup Checklist

### Codebase

- [ ] Clone `https://github.com/2017YANR02/cuberoot.me`.
- [ ] Start Codex from the repository root so scoped instructions and project hooks load.
- [ ] Run `/hooks`, review both user and project hooks, and trust the current definitions.
- [ ] Work in `core/` for pnpm commands; the repository root is not the workspace root.

### Browser Verification

- [ ] Confirm the in-app Playwright browser is available for UI checks.
- [ ] If browser startup is interrupted, repair the Codex MCP/plugin configuration; do not
  install or register it through Claude CLI commands.

### Skills and Memories

- [ ] Read skill instructions only when their trigger matches the task.
- [ ] Keep enforceable team rules in `AGENTS.md`, hooks, and version-controlled docs.
- [ ] Enable Codex memories when desired; use `/import` once to migrate retained Claude Code
  project memories before archiving the old local memory store.

## Team Tips

- Multiple agents can share one worktree. Preserve unrelated changes and stage only files from
  the current task.
- Verify behavior before reporting a fix. UI changes use the browser; logic changes use focused
  tests and typecheck.
- Commit is local by default. Do not push unless the deployment rules in `AGENTS.md` authorize it.

## Get Started

Open the repository root in Codex, trust the reviewed hooks with `/hooks`, then read `AGENTS.md`
before the first task.
