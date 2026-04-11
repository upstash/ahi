# Ahi

A framework for running independent agents in isolated containers. Each agent gets its own tools, skills, durable data, and schedule. No orchestration. No deployment.

Ahi implements the **agent server** architecture: instead of building an app server with routes, handlers, and orchestration code, you define agents as a folder structure and a config file. Ahi handles the rest.

## Quick Start

```bash
npm install -g @upstash/ahi

ahi init
ahi dev "do something useful"
ahi sync
ahi run "do something useful"
```

## Architecture

An agent server replaces traditional app servers with five primitives:

| Primitive | What it is |
|-----------|------------|
| **Agent** | The LLM. It reasons, decides, and acts. |
| **Tools** | TypeScript files that do work for the agent. |
| **Skills** | Markdown instructions that teach the agent how to use tools. |
| **Data** | Durable MD/JSON files. The agent's memory. Persists across runs. |
| **Schedules** | Cron for prompts, not code. |

Each agent runs in its own [Upstash Box](https://upstash.com/docs/box/overall/quickstart) — an isolated container with persistent storage that sleeps when idle and wakes instantly.

## Project Structure

An Ahi project is a folder with this layout:

```
my-project/
├── ahi.yaml            # Agent definitions and configuration
├── tools/              # TypeScript files the agent can execute
│   ├── search.ts
│   ├── trade.ts
│   └── portfolio.ts
├── skills/             # Markdown instructions for the agent
│   └── SKILL.md
├── data/               # Durable agent data (persists across runs)
│   ├── portfolio.json
│   └── memory.md
└── .env                # API keys (optional, not committed)
```

### ahi.yaml

The config file defines your agents, their models, and their schedules.

```yaml
tools: ./tools/
skills: ./skills/SKILL.md

agents:
  - name: my-agent
    model: claude-sonnet-4-6
    schedules:
      - cron: "30 14 * * 1-5"
        prompt: "Run daily trading analysis"
        timeout: 600000
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `tools` | Yes | Path to the tools directory. |
| `skills` | Yes | Path to the skill file (Markdown). |
| `agents` | Yes | List of agent definitions. |
| `agents[].name` | Yes | Unique name for the agent. Used as the Box name. |
| `agents[].model` | Yes | Model identifier (see [Models](#models)). |
| `agents[].provider` | No | Agent CLI to use. Inferred from model if omitted. |
| `agents[].schedules` | No | List of cron schedules. |
| `agents[].schedules[].cron` | Yes | Standard 5-field cron expression (UTC). |
| `agents[].schedules[].prompt` | Yes | The prompt to send to the agent. |
| `agents[].schedules[].timeout` | No | Timeout in milliseconds. |

You can define multiple agents in a single project. Each agent gets its own Box:

```yaml
tools: ./tools/
skills: ./skills/SKILL.md

agents:
  - name: trader-claude
    model: claude-opus-4-6
    schedules:
      - cron: "30 14 * * 1-5"
        prompt: "Run daily trading analysis"

  - name: trader-gemini
    model: gemini-3.1-pro
    schedules:
      - cron: "30 14 * * 1-5"
        prompt: "Run daily trading analysis"
```

### Tools

Tools are TypeScript files that the agent executes via shell commands. They are not imported as modules — the agent runs them with `npx tsx`:

```bash
npx tsx tools/trade.ts execute AAPL buy 1000
npx tsx tools/search.ts "market news today"
npx tsx tools/prices.ts current AAPL MSFT NVDA
```

A tool is a regular TypeScript script that reads arguments from `process.argv` and writes output to `stdout`:

```ts
// tools/example.ts
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "hello":
    console.log("Hello from example tool!");
    break;
  case "time":
    console.log(new Date().toISOString());
    break;
  default:
    console.log("Usage: npx tsx tools/example.ts <hello|time>");
}
```

Tools can import libraries, read/write files in `data/`, call external APIs — anything a normal Node.js script can do.

### Skills

A skill is a Markdown file that teaches the agent how to behave and which tools to use. It acts as the agent's system prompt.

```markdown
---
name: trading
description: Execute the daily virtual trading process
---

# Trading Skill

## Identity

You are a virtual portfolio manager. Your goal is to maximize
portfolio value through research-driven trading decisions.

## Tools

Get current portfolio state:
\`\`\`
npx tsx /workspace/home/tools/portfolio.ts get
\`\`\`

Execute a trade:
\`\`\`
npx tsx /workspace/home/tools/trade.ts execute <TICKER> buy <amount>
\`\`\`

## Process

1. Update prices
2. Review portfolio
3. Research market news
4. Make trades
5. Write diary entry
6. Save snapshot
```

The skill tells the agent *what* it is, *what tools* it has, and *what steps* to follow. The agent figures out the rest.

> **Note:** In the remote Box environment, tools are at `/workspace/home/tools/`. When running locally with `ahi dev`, the agent executes from your project directory, so use relative paths in your skill or let the agent resolve them.

### Data

The `data/` directory stores durable files the agent reads and writes — portfolios, diaries, memory, snapshots. These files persist across runs and survive tool/skill updates.

Data files are typically JSON or Markdown:

```
data/
├── portfolio.json    # Agent's state
├── diary.md          # Log of past actions
└── memory.md         # Accumulated knowledge
```

You don't manage these files. The agent creates and updates them as part of its process.

## CLI Reference

### `ahi init`

Scaffold a new Ahi project in the current directory.

```bash
ahi init
```

Creates:
- `ahi.yaml` — default config with one agent
- `tools/example.ts` — sample tool
- `skills/SKILL.md` — skill template
- `data/.gitkeep` — empty data directory

### `ahi dev <prompt>`

Run an agent locally for fast iteration. No Box involved — the agent runs on your machine using a locally installed agent CLI.

```bash
ahi dev "run daily trading analysis"
ahi dev --agent trader-claude "test the search tool"
```

**Options:**

| Flag | Description |
|------|-------------|
| `--agent <name>` | Agent name from ahi.yaml. Defaults to the first agent. |

**How it works:**

1. Reads `ahi.yaml` to determine the model and provider
2. Reads `skills/SKILL.md` as the agent's instructions
3. Spawns the appropriate agent CLI with your prompt:
   - **Claude models** → `claude` CLI
   - **OpenAI models** → `codex` CLI
   - **OpenCode models** → `opencode` CLI
4. The agent runs locally, executing tools and reading/writing `data/` in your project folder
5. Output streams to your terminal in real-time

**Prerequisites:** You must have the relevant agent CLI installed:

```bash
# For Claude models
npm install -g @anthropic-ai/claude-code

# For OpenAI models
npm install -g @openai/codex

# For OpenCode models
npm install -g opencode
```

**Environment variables:**

| Variable | Required for |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude models |
| `OPENAI_API_KEY` | OpenAI models |
| `GOOGLE_API_KEY` | Gemini models |

### `ahi run <prompt>`

Run an agent remotely on its Box. The agent executes in the cloud environment with its synced tools, skills, and data.

```bash
ahi run "run daily trading analysis"
ahi run --agent trader-gemini "check portfolio status"
```

**Options:**

| Flag | Description |
|------|-------------|
| `--agent <name>` | Agent name from ahi.yaml. Defaults to the first agent. |

**How it works:**

1. Connects to the agent's Box (or creates one if it doesn't exist)
2. Sends the prompt to the remote agent
3. Streams output back to your terminal

**Environment variables:**

| Variable | Required |
|----------|----------|
| `UPSTASH_BOX_API_KEY` | Yes |

### `ahi sync`

Push local files and schedules to the Box for all agents defined in `ahi.yaml`.

```bash
ahi sync
```

**What it syncs:**

1. **Files** — uploads everything in `tools/`, `skills/`, and `ahi.yaml` to each agent's Box
2. **Schedules** — deletes all existing schedules on each Box and recreates them from `ahi.yaml`
3. **Model** — configures the model on the Box if changed

Sync processes all agents. Each agent gets its own Box (matched by agent name).

**What it does NOT sync:**

- `data/` — agent data lives on the Box and is never overwritten by sync
- `.env` — environment variables are not uploaded

**Environment variables:**

| Variable | Required |
|----------|----------|
| `UPSTASH_BOX_API_KEY` | Yes |

**Lifecycle examples:**

| Change | Command | Effect |
|--------|---------|--------|
| Fix a bug in a tool | `ahi sync` | Only that file uploads. Data untouched. |
| Rewrite the agent's strategy | Edit SKILL.md, `ahi sync` | Same tools, same data, new behavior. |
| Switch from Claude to Gemini | Edit ahi.yaml, `ahi sync` | Tools, skills, data stay untouched. |
| Change a schedule | Edit ahi.yaml, `ahi sync` | Old schedules removed, new ones created. |

### `ahi console`

Start the monitoring dashboard locally.

```bash
ahi console
ahi console --port 8080
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--port <port>` | `3456` | Port to serve on. |

Opens a web UI at `http://localhost:<port>` with:

- **Sidebar** — vertical list of all agents with status indicators
- **Agent detail page** with four tabs:
  - **Files** — browse files on the Box (tools, skills, data)
  - **Run History** — past runs with prompt, status, duration, cost
  - **Logs** — agent log stream
  - **Schedules** — cron schedules with run counts and last status

**Environment variables:**

| Variable | Required |
|----------|----------|
| `UPSTASH_BOX_API_KEY` | Yes |

## Models

Ahi infers the agent CLI (provider) from the model name. You can also set `provider` explicitly in `ahi.yaml`.

| Model prefix | Provider | Agent CLI | Example |
|-------------|----------|-----------|---------|
| `claude-*` | claude | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `claude-opus-4-6`, `claude-sonnet-4-6` |
| `gpt-*` | openai | [Codex](https://github.com/openai/codex) | `gpt-5.3-codex`, `gpt-5.2-codex` |
| `gemini-*` | gemini | — | `gemini-3.1-pro` |
| `opencode/*` | opencode | [OpenCode](https://github.com/opencode-ai/opencode) | `opencode/claude-sonnet-4-6` |

## Environment Variables

Create a `.env` file in your project root (or export them in your shell):

```bash
# Required for sync, run, console
UPSTASH_BOX_API_KEY=your-box-api-key

# Required for ahi dev (depends on model)
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
GOOGLE_API_KEY=your-google-key
```

Get your Box API key from the [Upstash Console](https://console.upstash.com).

## Example: Botstreet

[Botstreet](https://botstreet.vercel.app) is three agent servers competing as stock traders. Same tools, same skills, different models.

```yaml
tools: ./tools/
skills: ./skills/SKILL.md

agents:
  - name: botstreet-claude
    model: claude-opus-4-6
    schedules:
      - cron: "30 14 * * 1-5"
        prompt: "Run daily trading analysis, research market news, make trades, and save a snapshot"
        timeout: 600000

  - name: botstreet-gemini
    model: gemini-3.1-pro
    schedules:
      - cron: "30 14 * * 1-5"
        prompt: "Run daily trading analysis, research market news, make trades, and save a snapshot"
        timeout: 600000

  - name: botstreet-openai
    model: gpt-5.4
    schedules:
      - cron: "30 14 * * 1-5"
        prompt: "Run daily trading analysis, research market news, make trades, and save a snapshot"
        timeout: 600000
```

Every weekday at 9:30 AM ET, each agent wakes up, reads the news, analyzes its portfolio, makes trades, writes a diary entry, and saves a snapshot. Between runs, the box sleeps. The data persists as JSON/MD files inside each box.

- [Live dashboard](https://botstreet.vercel.app)
- [Source code](https://github.com/upstash/botstreet)

## Stack

| Layer | Name | What it is |
|-------|------|------------|
| Architecture | Agent server | The idea — five primitives, no app code |
| Framework | Ahi | Conventions, CLI, console |
| Infrastructure | [Upstash Box](https://upstash.com/docs/box/overall/quickstart) | Containers, storage, scheduling |
| SDK | [@upstash/box](https://www.npmjs.com/package/@upstash/box) | Low-level programmatic access |

## Development

This is a monorepo with two packages:

```
ahi/
├── packages/
│   ├── cli/        # @upstash/ahi — the CLI
│   └── console/    # @upstash/ahi-console — the web dashboard
├── pnpm-workspace.yaml
└── package.json
```

```bash
# Install dependencies
pnpm install

# Build everything
pnpm build

# Build CLI only
pnpm --filter @upstash/ahi build

# Build Console only
pnpm --filter @upstash/ahi-console build

# Watch mode for CLI development
pnpm dev:cli
```

## License

MIT
