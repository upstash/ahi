import { mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";

const YAML_TEMPLATE = `tools: ./tools/
skills: ./skills/SKILL.md

agents:
  - name: my-agent
    harness: claude-code
    model: anthropic/claude-sonnet-4-6
`;

const SKILL_TEMPLATE = `---
name: notes
description: Save, review, and clear simple notes for the user
---

# Notes Skill

## Identity

You are a simple note-keeping agent.

Your job is to help the user save short notes to durable storage,
review what is already saved, and clear the list when asked.

## Tools

Save a note:

\`\`\`
npx tsx /workspace/home/tools/note.ts add <text>
\`\`\`

List saved notes:

\`\`\`
npx tsx /workspace/home/tools/note.ts list
\`\`\`

Clear all notes:

\`\`\`
npx tsx /workspace/home/tools/note.ts clear
\`\`\`

## Process

When you receive a prompt, follow these rules:

1. If the user wants to remember something, save it with the note tool.
2. If the user asks what is saved, list the notes first and then answer.
3. If the user asks to remove everything, use the clear command.
4. Keep responses short and explicit about what you saved or retrieved.
`;

const CLAUDE_TEMPLATE = `@skills/SKILL.md

# Ahi Development Instructions

This file is for local development only. Ahi does not upload \`CLAUDE.md\` to remote boxes.

## Purpose

Use this file to understand how to work on an Ahi project as a coding agent.
The deployed runtime behavior lives in the path configured by \`skills:\` in \`ahi.yaml\`, typically \`skills/SKILL.md\`.

## Source Of Truth

- \`ahi.yaml\` defines the agents, providers, models, setup commands, and schedules.
- \`skills/SKILL.md\` defines deployed runtime behavior.
- \`CLAUDE.md\` defines local development workflow for coding agents.
- \`tools/\` contains executable project tools.
- \`data/\` is project-local state during development. Remote runtime state lives in each box.

## Workflow

- Read \`ahi.yaml\` before making changes.
- Start with \`skills/SKILL.md\` to understand the runtime behavior you are changing.
- Read other files under \`skills/\` when the task depends on a specific workflow package.
- Use scripts in \`tools/\` instead of inventing replacement commands.
- Test changes locally with \`ahi dev\` before using \`ahi apply\`.
- Use \`ahi apply\` for code, skill, config, env, setup, and schedule changes.
- Use \`ahi pull-data\` or \`ahi push-data\` only when you intentionally want to transfer runtime data between local and remote.

## Boundaries

- Do not assume \`CLAUDE.md\` is available inside the remote box.
- Do not treat local \`data/\` as automatically synchronized with any remote agent.
- Do not change \`skills/SKILL.md\` unless you intend to change deployed runtime behavior.
`;

const AGENTS_TEMPLATE = `# Ahi Development Instructions

This file is for local development only. Ahi does not upload \`AGENTS.md\` to remote boxes.

## Purpose

Use this file to understand how to work on an Ahi project as a coding agent.
The deployed runtime behavior lives in the path configured by \`skills:\` in \`ahi.yaml\`, typically \`skills/SKILL.md\`.

## Source Of Truth

- \`ahi.yaml\` defines the agents, providers, models, setup commands, and schedules.
- \`skills/SKILL.md\` defines deployed runtime behavior.
- \`AGENTS.md\` defines local development workflow for coding agents.
- \`tools/\` contains executable project tools.
- \`data/\` is project-local state during development. Remote runtime state lives in each box.

## Workflow

- Read \`ahi.yaml\` before making changes.
- Start with \`skills/SKILL.md\` to understand the runtime behavior you are changing.
- Read other files under \`skills/\` when the task depends on a specific workflow package.
- Use scripts in \`tools/\` instead of inventing replacement commands.
- Test changes locally with \`ahi dev\` before using \`ahi apply\`.
- Use \`ahi apply\` for code, skill, config, env, setup, and schedule changes.
- Use \`ahi pull-data\` or \`ahi push-data\` only when you intentionally want to transfer runtime data between local and remote.

## Boundaries

- Do not assume \`AGENTS.md\` is available inside the remote box.
- Do not treat local \`data/\` as automatically synchronized with any remote agent.
- Do not change \`skills/SKILL.md\` unless you intend to change deployed runtime behavior.
`;

const NOTE_TOOL = `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const command = process.argv[2];
const text = process.argv.slice(3).join(" ").trim();

const dataDir = resolve(process.cwd(), "data");
const notesPath = resolve(dataDir, "notes.md");

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
}

function readNotes() {
  if (!existsSync(notesPath)) {
    return [];
  }

  const content = readFileSync(notesPath, "utf8").trim();
  if (!content) {
    return [];
  }

  return content
    .split("\\n")
    .filter(Boolean)
    .map((line) => line.replace(/^- /, ""));
}

function writeNotes(notes: string[]) {
  const content =
    notes.length > 0 ? notes.map((note) => \`- \${note}\`).join("\\n") + "\\n" : "";
  writeFileSync(notesPath, content);
}

ensureDataDir();

switch (command) {
  case "add": {
    if (!text) {
      console.log("Usage: npx tsx tools/note.ts add <text>");
      process.exit(1);
    }

    const notes = readNotes();
    notes.push(text);
    writeNotes(notes);
    console.log(\`Saved note \${notes.length}: \${text}\`);
    break;
  }

  case "list": {
    const notes = readNotes();
    if (notes.length === 0) {
      console.log("No notes saved.");
      break;
    }

    console.log(notes.map((note, index) => \`\${index + 1}. \${note}\`).join("\\n"));
    break;
  }

  case "clear":
    writeNotes([]);
    console.log("Cleared all notes.");
    break;

  default:
    console.log("Usage: npx tsx tools/note.ts <add|list|clear> [text]");
}
`;

const ENV_TEMPLATE = `# Required for ahi apply, run, pull-data, push-data
UPSTASH_BOX_API_KEY=

# Required for ahi dev and passed to the box on apply
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
OPENROUTER_API_KEY=
OPENCODE_API_KEY=
`;

export async function initCommand() {
  const cwd = process.cwd();

  if (existsSync(resolve(cwd, "ahi.yaml"))) {
    console.log(chalk.yellow("ahi.yaml already exists. Skipping init."));
    return;
  }

  // Create directories
  mkdirSync(resolve(cwd, "tools"), { recursive: true });
  mkdirSync(resolve(cwd, "skills"), { recursive: true });
  mkdirSync(resolve(cwd, "data"), { recursive: true });

  // Write files
  writeFileSync(resolve(cwd, "ahi.yaml"), YAML_TEMPLATE);
  writeFileSync(resolve(cwd, ".env.example"), ENV_TEMPLATE);
  writeFileSync(resolve(cwd, "CLAUDE.md"), CLAUDE_TEMPLATE);
  writeFileSync(resolve(cwd, "AGENTS.md"), AGENTS_TEMPLATE);
  writeFileSync(resolve(cwd, "skills", "SKILL.md"), SKILL_TEMPLATE);
  writeFileSync(resolve(cwd, "tools", "note.ts"), NOTE_TOOL);
  writeFileSync(resolve(cwd, "data", ".gitkeep"), "");

  console.log(chalk.green("Initialized Ahi project:"));
  console.log("  ahi.yaml");
  console.log("  .env.example");
  console.log("  CLAUDE.md");
  console.log("  AGENTS.md");
  console.log("  tools/note.ts");
  console.log("  skills/SKILL.md");
  console.log("  data/");
}
