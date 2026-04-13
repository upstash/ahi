# Ahi — Implementation Plan

## Overview
Ahi is an open-source framework for running independent agents in isolated containers. This monorepo contains two packages: the CLI and the Console.

## Monorepo Structure
```
ahi/
├── examples/         # Example agent projects
├── packages/
│   ├── cli/          # @upstash/ahi — global CLI tool
│   └── console/      # Web UI for monitoring agent servers
├── plan.md
├── blog.md
└── package.json
```

## CLI (`@upstash/ahi`)

### Commands
| Command | Description |
|---------|-------------|
| `ahi init` | Scaffold the folder structure (tools/, skills/, data/, ahi.yaml) |
| `ahi dev "prompt"` | Run an agent locally — fast iteration, no Box involved |
| `ahi run "prompt"` | Run an agent remotely on the Box, stream output back |
| `ahi sync` | Diff local vs remote, upload only changed files |
| `ahi console` | Open the monitoring dashboard |

### ahi.yaml Schema (from blog)
```yaml
tools: ./tools/
skills: ./skills/SKILL.md
setup:
  - pnpm install --frozen-lockfile

agents:
  - name: agent-name
    model: claude-opus-4.6
```

## Console
Web UI for monitoring agent servers. Shows which agents are running, sleeping, what data they've written, when they last ran.

---

## Decisions
- CLI framework: **Commander.js**
- Console framework: **SvelteKit**
- Infrastructure: **@upstash/box** SDK (existing, at `../box-projects/box/packages/sdk`)
- `ahi dev` local execution: **Shell out to existing agent CLIs** (Claude Code, Codex, OpenCode) — Ahi injects the skill and points the agent at the project folder, the agent CLI handles the loop
- Auth: `.env` file with `UPSTASH_BOX_API_KEY` + provider API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)

## `ahi dev` Flow
1. Read `ahi.yaml` → get agent config (provider, model)
2. Read `.env` → get API keys
3. Read `skills/SKILL.md` → agent instructions
4. Spawn the appropriate agent CLI (`claude`, `codex`, `opencode`) with:
   - The skill as system prompt / context
   - The user's prompt
   - Working directory set to the project folder
5. Stream output to terminal
6. Agent executes tools via shell commands (e.g. `npx tsx tools/note.ts add "remember this"`)
7. Agent reads/writes `data/` files directly on local filesystem

## Box SDK API Surface (key methods for Ahi)
- `Box.create(config)` — create a box with agent, runtime, env, skills, mcpServers
- `Box.get(boxId)` — reconnect to existing box
- `Box.list()` — list all boxes
- `box.agent.run({ prompt })` / `box.agent.stream({ prompt })` — run agent
- `box.fs.upload(files)` / `box.fs.list(path)` / `box.fs.read(path)` / `box.fs.download(files)`
- `box.schedule.createPrompt(opts)` / `box.schedule.createExec(opts)` / `box.schedule.list()`
- `box.exec.command(cmd)` / `box.exec.stream(cmd)`
- `box.pause()` / `box.resume()` / `box.delete()`
- Auth: `UPSTASH_BOX_API_KEY` env var or `apiKey` param

## `ahi sync` Flow
1. Read `ahi.yaml` and `.env`
2. For each agent in `ahi.yaml`:
   - Get or create the Box (by name)
   - Upload all files: `tools/`, `skills/`, `ahi.yaml`, and common runtime manifests
   - Run setup commands from `ahi.yaml` if present
   - Delete all existing schedules on the Box
   - Create new schedules from `ahi.yaml` agent config
   - Configure model if changed
3. Simple upload-all strategy for v1 (no diffing)

## `ahi console` Flow
1. Starts the SvelteKit Console app locally (e.g. `localhost:3000`)
2. Reads `UPSTASH_BOX_API_KEY` from env
3. Talks to Box API to fetch agent data

### Console UI
- **Left sidebar:** vertical agent list (name, status badge)
- **Agent detail page** with tabs:
  - **File Browser** — browse files on the Box (tools, skills, data)
  - **Run History** — list of runs (prompt, output, cost, duration, status)
  - **Logs** — agent logs
  - **Schedules** — cron schedules, last run status, next run time

## Agent Selection
- `ahi dev` / `ahi run`: default to first agent in `ahi.yaml`, override with `--agent <name>`
- `ahi sync`: always syncs all agents (each gets its own Box)

## `ahi init` Scaffold
```
my-project/
├── ahi.yaml          # single agent, placeholder model
├── .env.example      # example environment variables
├── tools/
│   └── note.ts       # simple durable note tool
├── skills/
│   └── SKILL.md      # starter note-keeper skill
└── data/             # empty, .gitkeep
```
- Scaffold includes `.env.example` but not a real `.env` file
- Silent scaffold with defaults (no interactive prompts)

## Open Questions
