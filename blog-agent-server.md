# What is an Agent Server?

An app server handles HTTP requests. An agent server handles prompts. Instead of routes, controllers, and middleware, you define five primitives:

| Primitive | What it is |
|-----------|------------|
| **Agent** | An LLM that reasons, decides, and acts |
| **Tools** | Scripts the agent can execute |
| **Skills** | Instructions that tell the agent what to do and how |
| **Data** | Files the agent reads and writes — its memory |
| **Schedule** | Cron that sends prompts, not code |

That's it. No orchestration code. No framework to learn first. Just a container with an LLM, some scripts, a system prompt, and a folder for persistent state.

## The Idea

Think about what a typical "AI agent" deployment looks like today. You write an app server. You set up routes for triggering the agent. You write orchestration code to manage tool calls. You handle state persistence. You configure infrastructure.

An agent server skips all of that. The container _is_ the server. The LLM _is_ the orchestrator. You just give it tools and tell it what to do.

Let's build one from scratch.

## Building an Agent Server with the Box SDK

We'll build a daily news researcher — an agent that wakes up every morning, researches a topic, and saves a one-sentence summary. No framework, no CLI. Just the `@upstash/box` SDK and three files.

### Step 1: The Tool

A tool is a TypeScript script. The agent runs it via shell. It reads arguments from `process.argv` and writes output to `stdout`. That's the entire contract.

Here's a tool that manages dated summaries in a file:

```typescript
// tools/news-summary.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const command = process.argv[2];
const date = process.argv[3];
const summary = process.argv.slice(4).join(" ").trim();

const dataDir = resolve(process.cwd(), "data");
const summaryPath = resolve(dataDir, "daily-summary.md");

mkdirSync(dataDir, { recursive: true });

function readEntries(): string[] {
  if (!existsSync(summaryPath)) return [];
  const content = readFileSync(summaryPath, "utf8").trim();
  return content ? content.split("\n").filter(Boolean).map((l) => l.replace(/^- /, "")) : [];
}

function writeEntries(entries: string[]) {
  writeFileSync(summaryPath, entries.map((e) => `- ${e}`).join("\n") + "\n");
}

switch (command) {
  case "save": {
    const entries = readEntries();
    const entry = `${date}: ${summary}`;
    const existing = entries.findIndex((e) => e.startsWith(`${date}: `));
    if (existing >= 0) entries[existing] = entry;
    else entries.push(entry);
    writeEntries(entries);
    console.log(`Saved summary for ${date}.`);
    break;
  }
  case "list":
    console.log(readEntries().join("\n") || "No summaries saved.");
    break;
  case "latest": {
    const entries = readEntries();
    console.log(entries[entries.length - 1] || "No summaries saved.");
    break;
  }
  default:
    console.log("Usage: npx tsx tools/news-summary.ts <save|list|latest> [args]");
}
```

No dependencies. Just Node.js built-ins. The tool doesn't know it's being called by an AI — it's a normal script.

### Step 2: The Skill

A skill is a Markdown file that becomes the agent's system prompt. It tells the agent who it is, what tools it has, and how to use them:

```markdown
---
name: daily-news-researcher
description: Research one news topic and save a one-sentence summary each day
---

# Daily News Researcher

## Identity

You are a daily news research agent.

Your job is to research the assigned topic, identify the most important
new development, and save a single concise summary sentence.

## Tools

Save a dated summary:
\`\`\`
npx tsx /workspace/home/tools/news-summary.ts save <YYYY-MM-DD> <summary>
\`\`\`

List saved summaries:
\`\`\`
npx tsx /workspace/home/tools/news-summary.ts list
\`\`\`

Show the latest saved summary:
\`\`\`
npx tsx /workspace/home/tools/news-summary.ts latest
\`\`\`

## Process

1. Research the requested topic using your available capabilities.
2. Focus on developments that are genuinely new for the current date.
3. Write exactly one sentence in plain language.
4. Save the sentence with today's date.
5. Don't duplicate a sentence if it's already saved for today.
```

The skill is the bridge between the LLM and the tool. The agent reads the skill, understands the tool interface, and figures out the rest.

### Step 3: Wire It Up

Now we connect everything with a script. Create a Box, upload the files, set a schedule, and run it:

```typescript
// deploy.ts
import { Box } from "@upstash/box";

const API_KEY = process.env.UPSTASH_BOX_API_KEY!;

async function deploy() {
  // Create a box with an agent
  const box = await Box.create({
    apiKey: API_KEY,
    name: "news-researcher",
    runtime: "node",
    agent: {
      provider: "claude",
      model: "claude-sonnet-4-6",
    },
  });

  // Upload the tool and skill
  await box.files.upload([
    { path: "tools/news-summary.ts", destination: "/workspace/home/tools/news-summary.ts" },
    { path: "skills/SKILL.md", destination: "/workspace/home/skills/SKILL.md" },
  ]);

  // Schedule a daily run at 9am UTC
  await box.schedule.agent({
    cron: "0 9 * * *",
    prompt: "Research the latest AI news and save today's one-sentence summary.",
    timeout: 300000,
  });

  console.log("Deployed. The agent will run every day at 9am UTC.");

  // Or run it right now
  const stream = await box.agent.stream({
    prompt: "Research the latest AI news and save today's one-sentence summary.",
  });

  for await (const chunk of stream) {
    if (chunk.type === "text-delta") {
      process.stdout.write(chunk.text);
    }
  }
}

deploy();
```

That's about 30 lines of actual logic. No routes. No handlers. No orchestration. The Box is the server. The LLM is the orchestrator.

### What Happens at Runtime

Every morning at 9am UTC:

1. The box wakes up (it was sleeping — you don't pay for idle)
2. The agent receives the prompt
3. It reads the skill to understand its job
4. It uses web search to research the topic
5. It calls `npx tsx tools/news-summary.ts save 2026-04-11 "..."` to persist the result
6. The box goes back to sleep

The `data/daily-summary.md` file accumulates over time:

```markdown
- 2026-04-07: OpenAI released GPT-5.4 with native tool-use streaming.
- 2026-04-08: Google DeepMind published results showing Gemini 3.1 outperforming prior models on agentic coding benchmarks.
- 2026-04-09: Anthropic announced Claude 4.6 Opus with 1M token context.
- 2026-04-10: Meta open-sourced a new agent framework built on Llama 4.
- 2026-04-11: Microsoft integrated Copilot agents directly into Azure Functions.
```

The data persists across runs. The agent can read its own history, notice trends, and build on previous work.

## Why Not Just Write an App?

You could build this with a cron job, a web scraper, and a database. But consider what the agent server gives you:

**No orchestration code.** You didn't write a single line of "call the LLM, parse the response, execute the tool, handle errors." The agent handles all of that.

**Swap models, keep everything else.** Change `claude-sonnet-4-6` to `gemini-3.1-pro` in one line. The tools, skill, and data stay the same.

**Skills compose.** The skill is just Markdown. You can rewrite the agent's entire strategy without touching any code. Add a new tool, mention it in the skill, and the agent starts using it.

**State is just files.** No database. No ORM. The agent reads and writes files in `data/`. You can inspect them, version them, or sync them. The data belongs to the agent, not to your application code.

## Scaling Up: The Ahi CLI

The script above works, but managing multiple agents, syncing files on every change, and configuring schedules by hand gets repetitive.

[Ahi](https://github.com/upstash/ahi) is a CLI that turns the agent server pattern into a folder convention:

```
my-project/
├── ahi.yaml              # Agent definitions
├── tools/
│   └── news-summary.ts   # Same tool, same file
├── skills/
│   └── SKILL.md           # Same skill, same file
└── data/
    └── daily-summary.md   # Managed by the agent
```

```yaml
# ahi.yaml
tools: ./tools/
skills: ./skills/SKILL.md

agents:
  - name: news-researcher
    model: claude-sonnet-4-6
    schedules:
      - cron: "0 9 * * *"
        prompt: "Research the latest AI news and save today's one-sentence summary."
        timeout: 300000
```

Then:

```bash
ahi apply   # Apply tools, skills, and schedules to the box
ahi run "Research the latest AI news"   # Run immediately
ahi console # Monitor runs, logs, files, schedules
```

The CLI replaces the deploy script. The folder structure replaces the Box SDK calls. But underneath, it's the same five primitives: agent, tools, skills, data, schedule.

## What Can You Build?

An agent server is useful anywhere you'd otherwise build a backend that mostly calls an LLM and does some I/O:

- **Research agents** — daily market analysis, competitor monitoring, paper summaries
- **Ops agents** — check dashboards, aggregate alerts, write status reports
- **Data agents** — pull from APIs, transform, save structured output
- **Personal agents** — track habits, summarize news, manage reading lists

Each agent gets its own isolated container with its own tools, data, and schedule. You can run one or twenty — they don't share state and they don't interfere with each other.

## Try It

```bash
npm install -g @upstash/ahi

ahi init
ahi dev "Research the latest AI news and save today's summary"
```

Or skip the CLI and use the [Box SDK](https://www.npmjs.com/package/@upstash/box) directly — the 30-line script above is all you need.

---

[Ahi on GitHub](https://github.com/upstash/ahi) · [Upstash Box](https://upstash.com/docs/box/overall/quickstart) · [Botstreet — live example with three competing trader agents](https://botstreet.vercel.app)
