# Ahi

A framework for running independent agents in isolated containers with [Upstash Box](https://upstash.com/docs/box/overall/quickstart).

Each agent gets its own container with tools, skills, durable data, and a schedule. No orchestration. No deployment.

## Install

```bash
npm install -g @upstash/ahi
```

## Quick Start

```bash
ahi init                          # scaffold project structure
ahi dev "remember to buy milk"    # run agent locally
ahi sync                          # push to the box
ahi run "list my notes"           # run remotely
```

## Project Structure

```
my-project/
├── ahi.yaml          # agent definitions
├── .env              # API keys
├── tools/            # scripts agents execute
├── skills/           # markdown instructions (system prompts)
└── data/             # durable files managed by the agent
```

## ahi.yaml

```yaml
tools: ./tools/
skills: ./skills/SKILL.md

env:
  BRAVE_API_KEY:        # forwarded from local .env
  NODE_ENV: production  # explicit value

setup:
  - npm install

agents:
  - name: my-agent
    model: claude-sonnet-4-6
    schedules:
      - cron: "0 9 * * *"
        prompt: "Do your daily task"
        timeout: 300000
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `tools` | yes | Path to tools directory |
| `skills` | yes | Path to skill file |
| `env` | no | Env vars to write inside the box. Empty value = forward from local environment |
| `setup` | no | Commands to run on the box after file upload (e.g. `npm install`) |
| `agents` | yes | List of agent definitions |

### Agent Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Agent name (also the box name) |
| `model` | yes | Model identifier (e.g. `claude-sonnet-4-6`, `gpt-5.4`, `gemini-3.1-pro`) |
| `provider` | no | Override inferred provider (`claude`, `openai`, `gemini`, `opencode`) |
| `schedules` | no | Cron schedules with prompt and optional timeout |

## Commands

### `ahi init`

Scaffolds a minimal project with a notes agent, tool, and skill.

### `ahi dev <prompt>`

Runs the agent locally using the installed CLI (Claude Code, Codex, or OpenCode).

```bash
ahi dev "save a note about the meeting"
ahi dev "list my notes" --agent my-agent
```

### `ahi sync`

Pushes tools, skills, env vars, setup commands, and schedules to the box. Creates the box if it doesn't exist.

Provider API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`) are automatically picked up from your environment when creating a box.

### `ahi run <prompt>`

Runs the agent remotely on the box and streams output back.

```bash
ahi run "analyze today's data"
ahi run "generate report" --agent my-agent
```

### `ahi pull`

Downloads the agent's `data/` directory from the box to your local project.

```bash
ahi pull
ahi pull --agent my-agent
```

### `ahi push`

Uploads your local `data/` directory to the box.

```bash
ahi push
ahi push --agent my-agent
```

## Environment Variables

| Variable | Used for |
|----------|----------|
| `UPSTASH_BOX_API_KEY` | Required for `sync`, `run`, `pull`, `push` |
| `ANTHROPIC_API_KEY` | Passed to box when provider is `claude` |
| `OPENAI_API_KEY` | Passed to box when provider is `openai` |
| `GOOGLE_API_KEY` | Passed to box when provider is `gemini` or `opencode` |

## Five Primitives

Ahi implements the **agent server** architecture:

| Primitive | What it is |
|-----------|------------|
| **Agent** | The LLM that reasons and acts |
| **Tools** | TypeScript scripts the agent executes via shell |
| **Skills** | Markdown instructions (system prompt) |
| **Data** | Durable JSON/MD files that persist across runs |
| **Schedule** | Cron that sends prompts, not code |

## Links

- [Upstash Box docs](https://upstash.com/docs/box/overall/quickstart)
- [Botstreet](https://botstreet.vercel.app) — three agents competing as stock traders ([source](https://github.com/upstash/botstreet))
