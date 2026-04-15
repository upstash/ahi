import { spawn } from "child_process";
import { existsSync } from "fs";
import { delimiter, join, resolve } from "path";
import chalk from "chalk";
import { loadDevConfig, loadEnv, resolveAgent, type AgentConfig, type AgentHarness } from "../config.js";
import { prepareLocalSkills, resolveLocalInstructionPath } from "../skills.js";

interface DevOptions {
  agent?: string;
}

interface DevAgentConfig {
  name: string;
  harness: AgentHarness;
  model?: string;
}

export async function devCommand(prompt: string, options: DevOptions) {
  const cwd = process.cwd();
  loadEnv(cwd);

  const config = loadDevConfig(cwd);

  // If a specific agent is requested, run only that one with inherited stdio
  if (options.agent) {
    if (config.agents.length === 0) {
      console.error(chalk.red(`No agents are defined in ahi.yaml. Remove ${chalk.bold("--agent")} to use the local development agent.`));
      process.exit(1);
    }

    const agent = resolveAgent(config, options.agent);
    return runSingleAgentDev(agent, config, prompt, cwd);
  }

  const agent = resolveLocalDevAgent(cwd);
  return runSingleAgentDev(agent, config, prompt, cwd);
}

function runSingleAgentDev(
  agent: DevAgentConfig | AgentConfig,
  config: { skills: string },
  prompt: string,
  cwd: string,
) {
  const skillPath = prepareLocalSkills(cwd, agent.harness, config.skills);
  const model = "model" in agent ? agent.model : undefined;

  console.log(chalk.blue(`Running agent ${chalk.bold(agent.name)} locally`));
  console.log(
    chalk.dim(
      model
        ? `Harness: ${agent.harness} | Model: ${model}`
        : `Harness: ${agent.harness} | Model: local default`,
    ),
  );
  console.log();

  const { cmd, args } = buildAgentCommand({
    harness: agent.harness,
    model,
    prompt,
    skillPath,
    cwd,
  });

  const child = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env },
  });

  child.on("error", (err) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(
        chalk.red(`\n"${cmd}" not found. Install it first:\n`),
      );
      printInstallHint(agent.harness);
    } else {
      console.error(chalk.red(err.message));
    }
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

function buildAgentCommand(opts: {
  harness: AgentHarness;
  model?: string;
  prompt: string;
  skillPath: string;
  cwd: string;
}): { cmd: string; args: string[] } {
  switch (opts.harness) {
    case "claude-code":
      return {
        cmd: "claude",
        args: [
          "-p",
          "--system-prompt-file",
          opts.skillPath,
          ...(opts.model ? ["--model", opts.model] : []),
          "--dangerously-skip-permissions",
          opts.prompt,
        ],
      };

    case "codex":
      return {
        cmd: "codex",
        args: [
          "exec",
          "--full-auto",
          ...(opts.model ? ["--model", opts.model] : []),
          opts.prompt,
        ],
      };

    case "opencode":
      return {
        cmd: "opencode",
        args: [
          "run",
          ...(opts.model ? ["--model", opts.model] : []),
          opts.prompt,
        ],
      };

    default:
      // Default to claude-code.
      return {
        cmd: "claude",
        args: [
          "-p",
          "--system-prompt-file",
          opts.skillPath,
          ...(opts.model ? ["--model", opts.model] : []),
          "--dangerously-skip-permissions",
          opts.prompt,
        ],
      };
  }
}

function resolveLocalDevAgent(cwd: string): DevAgentConfig {
  const hasClaudeRoot = existsSync(resolve(cwd, "CLAUDE.md"));
  const hasAgentsRoot = existsSync(resolve(cwd, "AGENTS.md"));

  const preferredHarnesses: AgentHarness[] = [];

  if (hasClaudeRoot && commandExists("claude")) {
    preferredHarnesses.push("claude-code");
  }

  if (hasAgentsRoot) {
    if (commandExists("codex")) preferredHarnesses.push("codex");
    if (commandExists("opencode")) preferredHarnesses.push("opencode");
  }

  if (preferredHarnesses.length === 0) {
    if (commandExists("claude")) preferredHarnesses.push("claude-code");
    if (commandExists("codex")) preferredHarnesses.push("codex");
    if (commandExists("opencode")) preferredHarnesses.push("opencode");
  }

  const harness =
    preferredHarnesses[0]
    ?? (hasAgentsRoot ? "codex" : "claude-code");

  const skillPath = resolveLocalInstructionPath(harness, cwd, "./skills/SKILL.md");
  if (!existsSync(skillPath)) {
    console.error(
      chalk.red(
        `No local instruction entrypoint found. Create ${chalk.bold("CLAUDE.md")}, ${chalk.bold("AGENTS.md")}, or ${chalk.bold("skills/SKILL.md")}.`,
      ),
    );
    process.exit(1);
  }

  return {
    name: "local",
    harness,
  };
}

function commandExists(command: string): boolean {
  const pathEnv = process.env.PATH ?? "";
  const entries = pathEnv.split(delimiter).filter(Boolean);

  for (const entry of entries) {
    if (existsSync(join(entry, command))) {
      return true;
    }
  }

  return false;
}

function printInstallHint(harness: AgentHarness) {
  switch (harness) {
    case "claude-code":
      console.error("  npm install -g @anthropic-ai/claude-code");
      break;
    case "codex":
      console.error("  npm install -g @openai/codex");
      break;
    case "opencode":
      console.error("  npm install -g opencode");
      break;
    default:
      console.error(`  Install the CLI for harness "${harness}"`);
  }
}
