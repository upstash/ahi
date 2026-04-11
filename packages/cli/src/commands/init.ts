import { mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";

const YAML_TEMPLATE = `tools: ./tools/
skills: ./skills/SKILL.md

agents:
  - name: my-agent
    model: claude-sonnet-4-6
    schedules:
      - cron: "0 9 * * *"
        prompt: "Run the daily task"
        timeout: 300000
`;

const SKILL_TEMPLATE = `---
name: my-skill
description: Describe what your agent does
---

# Agent Skill

## Identity

You are an AI agent. Describe your role and purpose here.

## Tools

List the tools available and how to use them:

\`\`\`
npx tsx /workspace/home/tools/example.ts <args>
\`\`\`

## Process

When you receive a prompt, follow these steps:

1. Step one
2. Step two
3. Step three
`;

const EXAMPLE_TOOL = `const args = process.argv.slice(2);
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
`;

const ENV_TEMPLATE = `# Required for ahi sync, ahi run, and ahi console
UPSTASH_BOX_API_KEY=

# Required for ahi dev, depending on the model/provider you use
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
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
  writeFileSync(resolve(cwd, "skills", "SKILL.md"), SKILL_TEMPLATE);
  writeFileSync(resolve(cwd, "tools", "example.ts"), EXAMPLE_TOOL);
  writeFileSync(resolve(cwd, "data", ".gitkeep"), "");

  console.log(chalk.green("Initialized Ahi project:"));
  console.log("  ahi.yaml");
  console.log("  .env.example");
  console.log("  tools/example.ts");
  console.log("  skills/SKILL.md");
  console.log("  data/");
}
