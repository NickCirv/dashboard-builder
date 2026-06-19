<div align="center">

# dashboard-builder

**Generate a terminal dashboard from a plain English description — CPU, git, timers, and more in one view.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue?labelColor=0B0A09)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?labelColor=0B0A09)](https://nodejs.org)

</div>

## Install

```bash
npx github:NickCirv/dashboard-builder --system
```

No global install needed. Runs instantly.

## Usage

```bash
# Preset dashboards (no API key needed)
npx github:NickCirv/dashboard-builder --git        # git log, status, changed files
npx github:NickCirv/dashboard-builder --system     # CPU, memory, disk, uptime
npx github:NickCirv/dashboard-builder --dev        # CPU + git + npm scripts
npx github:NickCirv/dashboard-builder --focus      # Pomodoro timer + commits + TODOs
npx github:NickCirv/dashboard-builder --project    # Auto-detect project type + stats
npx github:NickCirv/dashboard-builder --list       # Show all presets

# AI mode — generates a custom layout from your description
export ANTHROPIC_API_KEY=sk-ant-...
npx github:NickCirv/dashboard-builder "show CPU, memory, and recent git commits"
npx github:NickCirv/dashboard-builder "pomodoro timer with git status and TODO count"
```

| Flag | Description |
|------|-------------|
| `--git` | Git log, status, and changed files |
| `--system` | CPU load, memory, disk, uptime |
| `--dev` | CPU + recent commits + npm scripts |
| `--focus` | Pomodoro timer + commits + TODO count |
| `--project` | Auto-detected project info + git + memory |
| `--list` | Print all available preset names |
| `--save <file.json>` | Generate config and save to file |
| `--load <file.json>` | Run a previously saved config |
| `--preview <name>` | Print a preset's JSON config |

**Controls:** `q` or `Ctrl-C` to stop. Terminal resize is handled automatically.

## What it does

dashboard-builder renders a live, auto-refreshing terminal dashboard built entirely from Node.js built-ins — no external dependencies. Preset layouts cover the most common dev scenarios out of the box. With an `ANTHROPIC_API_KEY`, it sends your plain-English description to Claude Haiku, which generates a panel layout as JSON, then runs it immediately. Without a key, it fuzzy-matches your description to the nearest preset.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Dev Dashboard                                        Refreshing in 2s│
├──────────────────────────────┬───────────────────────────────────────┤
│  CPU Load                    │  Recent Commits                       │
│  ████░░░░░░░░░░░░░░ 18%      │  • a3f9c12 feat: add auth (2h ago)   │
│  1m:  0.45  5m:  0.52        │  • b7e2109 fix: redirect (5h ago)    │
├──────────────────────────────┼───────────────────────────────────────┤
│  Git Status                  │  npm Scripts                         │
│  ● main  Changed: 3          │  • dev: vite                         │
│  Staged: 1  Untracked: 2     │  • build: tsc && vite build          │
└──────────────────────────────┴───────────────────────────────────────┘
```

---
<sub>Zero dependencies · Node ≥18 · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>
