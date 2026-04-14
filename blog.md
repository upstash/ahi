# Ahi: a framework to run independent agents

Ahi is an open-source framework for running each agent in its own isolated container with tools, skills, durable data, and a schedule. No orchestration. No deployment.

---

The `Ahi` name comes from the Ahilik tradition in 13th-century Anatolia (modern-day Turkey). After the Mongol invasions left the region without central authority, craftsmen organized into brotherhoods called Ahi guilds. Each Ahi was an independent craftsman with a specific trade, their own tools, and a shared code of conduct. They provided order through skill and structure, not top-down control. An Ahi agent works the same way — independent, skilled, self-governing.

---

**The problem**

If you're running AI agents for your users today, you're probably building an app server. You write routes, handlers, and orchestration code. You store agent state in a database. You build tenant isolation yourself. You deploy everything as one unit.

It works — until you have 100 agents, each needing its own memory, its own tools, its own schedule. At that point, you're not building an app anymore. You're building infrastructure to run agents.

**Agent server: a different architecture**

Ahi implements an architecture we call an agent server. It replaces application servers with five primitives:

- **Agent** — the LLM. It reasons, decides, and acts.
- **Tools** — code that does work for the agent.
- **Skills** — instructions that teach the agent how to use tools.
- **Data** — durable MD/JSON. The agent's memory. Persists across runs.
- **Schedules** — cron for prompts, not code.

[IMAGE: agent-server-diagram.png — the five primitives inside a single container]

**Why not just use an app server?**

You could build all of this on a traditional app server. But here's what you'd actually be building on top of your agent logic — and what an agent server gives you for free:

- **Isolated by default.** An app server shares one process across all users. You build isolation yourself — scoped queries, permission checks, tenant separation. An agent server gives you one container per tenant. Isolation isn't a permission layer you build — it's a container boundary that already exists.
- **State is a filesystem, not a database.** An app server stores agent state in Postgres or Redis. You write schemas, migrations, serialization. An agent server stores state as JSON files on disk. The agent reads and writes files. No ORM, no driver, no schema.
- **Sleep/wake — pay only when active.** An app server is a running process — you pay whether agents are active or not. An agent server sleeps when idle, wakes instantly, costs nothing in between. With 10,000 per-user agents, most are idle at any given time. You only pay for the ones working.
- **No orchestration code.** An app server needs glue code: receive request, load user context, pick model, call tools, save state, return response. An agent server removes all of that. The agent reads its skills, calls its tools, writes its data. Zero lines of orchestration.
- **No deploys.** An app server ships everything in one git push. Change a tool, redeploy the whole app. An agent server lets you sync one file. The rest keeps running untouched.

|  | App Server | Agent Server |
| --- | --- | --- |
| **Isolation** | Software-defined (RBAC, scoped queries) | Hardware-defined (one container per agent) |
| **State** | External DB (Postgres, Redis) | Local filesystem (durable files) |
| **Cost model** | Pay for running processes | Sleep/wake — pay only when active |
| **Orchestration** | Hand-written glue code | Zero — agent reads skills, calls tools |
| **Deployment** | Full CI/CD for any change | File-based sync (update one file) |

[IMAGE: app-server-vs-agent-server.png — side-by-side comparison diagram]

**Example: Botstreet**

[Botstreet](https://botstreet.vercel.app/) is three agent servers competing as stock traders. Same tools, same skills, different models. Each runs in its own Upstash Box. Here's the project structure:

```
botstreet/
├── ahi.yaml
├── tools/
│   ├── trade.ts
│   ├── portfolio.ts
│   ├── prices.ts
│   ├── snapshot.ts
│   └── search.ts
├── skills/
│   └── SKILL.md
└── data/
    ├── portfolio.json
    └── memory.md
```

Every weekday at 9:30 AM ET, each agent wakes up, reads the news, analyzes its portfolio, makes trades, writes a diary entry, and saves a snapshot. Between runs, the box sleeps. The data — portfolio state, trade history, diary entries — persists as JSON/MD files inside each box. No database, no app server, no orchestration code.

**What Ahi gives you**

Ahi is the framework that makes this easy. It gives you three things:

**Conventions.** The folder structure (`tools/`, `skills/`, `data/`) and a config file (`ahi.yaml`) that maps to the five primitives. The folder structure is the convention.

The `ahi.yaml` for Botstreet defines three agents sharing the same tools and skills:

```jsx
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

**CLI.** Five commands:

```jsx
ahi init              # scaffold the folder structure
ahi dev "prompt"      # run an agent locally — fast iteration
ahi run "prompt"      # run an agent remotely on the box
ahi apply             # apply project files and schedules to the box
ahi console           # open the monitoring dashboard
```

There's no deploy step. Each primitive has its own lifecycle:

- Fix a bug in a tool → `ahi apply`. Only that file updates remotely.
- Test a change locally → `ahi dev "try the new tool"`. No upload, instant feedback.
- Trigger a remote run → `ahi run "run daily trading analysis"`. Runs on the box, streams output back.
- Rewrite the agent's strategy → update [SKILL.md](http://SKILL.md), run `ahi apply`. Same tools, same data, new behavior.
- Switch from Claude to Gemini → change the model in `ahi.yaml`, run `ahi apply`. Tools, skills, and data stay untouched.
- The agent writes its own data → you never touch it. It survives every update above.

No build step, no container image, no CI pipeline. Your local folder is the source of truth.

**Console.** An open-source web UI for monitoring your agent servers. See which agents are running, sleeping, what data they've written, when they last ran.

**Get started**

| Layer | Name | What it is |
| --- | --- | --- |
| Architecture | Agent server | The idea — five primitives, no app code |
| Framework | Ahi | Conventions, CLI, console |
| Infrastructure | Upstash Box | Containers, storage, scheduling |
| SDK | @upstash/box | Low-level programmatic access |

```jsx
npm install -g @upstash/ahi
ahi init
ahi dev "do something useful"    # test locally
ahi apply                         # apply project state to the box
ahi run "do something useful"    # run remotely
```

- [Ahi on GitHub](https://github.com/upstash/ahi)
- [Upstash Box docs](https://upstash.com/docs/box/overall/quickstart)
- [Botstreet live dashboard](https://botstreet.vercel.app)
- [Botstreet source](https://github.com/upstash/botstreet)
