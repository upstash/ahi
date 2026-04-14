# Ahi

If you're running AI agents for your users, you're probably building an app server — routes, handlers, orchestration code, tenant isolation. Ahi replaces all of that.

Ahi is an open-source framework for running each agent in its own isolated container with tools, skills, durable data, and a schedule. No orchestration. No deployment.

> The name comes from the _Ahilik_ tradition — independent craftsmen in 13th-century Anatolia who each had their own trade, their own tools, and a shared code of conduct. An Ahi agent works the same way.

Powered by [Upstash Box](https://upstash.com/docs/box/overall/quickstart). Read the [launch blog post](https://upstash.com/blog/ahi).

## Why Not Just Use an App Server?

You could build all of this on a traditional app server. But here's what you'd actually be building on top of your agent logic — and what an agent server gives you for free:

|                   | App Server                              | Agent Server                                 |
| ----------------- | --------------------------------------- | -------------------------------------------- |
| **Isolation**     | Software-defined (RBAC, scoped queries) | Container-isolated (one container per agent) |
| **State**         | External DB (Postgres, Redis)           | Local filesystem (durable files)             |
| **Cost model**    | Pay for running processes               | Sleep/wake — pay only when active            |
| **Orchestration** | Hand-written glue code                  | Zero — agent reads skills, calls tools       |
| **Deployment**    | Full CI/CD for any change               | File-based sync (update one file)            |

## Five Primitives

Ahi implements the **agent server** architecture. Instead of app code, you get five primitives:

![Agent Server Primitives](https://upstash.com/blog/agent-server/primitives-light.png)

| Primitive    | What it is                                      |
| ------------ | ----------------------------------------------- |
| **Agent**    | The LLM that reasons and acts                   |
| **Tools**    | TypeScript scripts the agent executes via shell |
| **Skills**   | Markdown instructions (system prompt)           |
| **Data**     | Durable JSON/MD files that persist across runs  |
| **Schedule** | Cron that sends prompts, not code               |

Each primitive has its own lifecycle. Fix a bug in a tool — `ahi sync`, only that file uploads. Rewrite the agent's strategy — update the skill file, `ahi sync`. Same tools, same data, new behavior. Switch from Claude to GPT — change the model in `ahi.yaml`, `ahi sync`. Tools, skills, and data stay untouched.

## Install

```
npm install -g @upstash/ahi
```

## Quick Start

```
ahi init                          # scaffold project structure
cp .env.example .env              # add your API keys
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

The folder structure is the convention. `tools/` maps to Tools, `skills/` maps to Skills, `data/` maps to Data. The `ahi.yaml` defines Agents and Schedules.

## ahi.yaml

```yaml
tools: ./tools/
skills: ./skills/SKILL.md

env:
  BRAVE_API_KEY: # forwarded from local .env
  NODE_ENV: production # explicit value

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

### Config Fields

| Field    | Required | Description                                                                    |
| -------- | -------- | ------------------------------------------------------------------------------ |
| `tools`  | yes      | Path to tools directory                                                        |
| `skills` | yes      | Path to skill file                                                             |
| `env`    | no       | Env vars to write inside the box. Empty value = forward from local environment |
| `setup`  | no       | Commands to run on the box after file upload (e.g. `npm install`)              |
| `agents` | yes      | List of agent definitions                                                      |

### Agent Fields

| Field       | Required | Description                                                              |
| ----------- | -------- | ------------------------------------------------------------------------ |
| `name`      | yes      | Agent name (also the box name)                                           |
| `model`     | yes      | Model identifier (e.g. `claude-sonnet-4-6`, `gpt-5.4`, `gemini-3.1-pro`) |
| `provider`  | no       | Override inferred provider (`claude`, `openai`, `gemini`, `opencode`)    |
| `schedules` | no       | Cron schedules with prompt and optional timeout                          |

## Commands

### `ahi init`

Scaffolds a minimal project with a notes agent, tool, and skill.

### `ahi dev <prompt>`

Runs the agent locally using the installed CLI (Claude Code, Codex, or OpenCode).

```
ahi dev "save a note about the meeting"
ahi dev "list my notes" --agent my-agent
```

### `ahi sync`

Pushes tools, skills, env vars, setup commands, and schedules to the box. Creates the box if it doesn't exist.

Provider API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`) are automatically picked up from your environment when creating a box.

### `ahi run <prompt>`

Runs the agent remotely on the box and streams output back.

```
ahi run "analyze today's data"
ahi run "generate report" --agent my-agent
```

### `ahi pull`

Downloads the agent's `data/` directory from the box to your local project.

```
ahi pull
ahi pull --agent my-agent
```

### `ahi push`

Uploads your local `data/` directory to the box.

```
ahi push
ahi push --agent my-agent
```

## Environment Variables

| Variable              | Used for                                              |
| --------------------- | ----------------------------------------------------- |
| `UPSTASH_BOX_API_KEY` | Required for `sync`, `run`, `pull`, `push`            |
| `ANTHROPIC_API_KEY`   | Passed to box when provider is `claude`               |
| `OPENAI_API_KEY`      | Passed to box when provider is `openai`               |
| `GOOGLE_API_KEY`      | Passed to box when provider is `gemini` or `opencode` |

## Example: Botstreet

[Botstreet](https://botstreet.vercel.app/) is three agents competing as stock traders. Same tools, same skills, different models. Each runs in its own Upstash Box.

```yaml
tools: ./tools/
skills: ./skills/SKILL.md

agents:
  - name: botstreet-claude
    model: claude-opus-4.6
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

Every weekday at 9:30 AM ET, each agent wakes up, reads the news, analyzes its portfolio, makes trades, and saves a snapshot. Between runs, the box sleeps. The data — portfolio state, trade history, diary entries — persists as files inside each box.

[Live dashboard](https://botstreet.vercel.app) · [Source](https://github.com/upstash/botstreet)

## Links

- [Upstash Box docs](https://upstash.com/docs/box/overall/quickstart)
- [Launch blog post](https://upstash.com/blog/ahi)
- [Botstreet live dashboard](https://botstreet.vercel.app)
- [Botstreet source](https://github.com/upstash/botstreet)
