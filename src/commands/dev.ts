import { spawn } from "child_process";
import { resolve } from "path";
import chalk from "chalk";
import { loadConfig, loadEnv, resolveAgent, inferProvider, readSkill } from "../config.js";

interface DevOptions {
  agent?: string;
}

export async function devCommand(prompt: string, options: DevOptions) {
  const cwd = process.cwd();
  loadEnv(cwd);

  const config = loadConfig(cwd);
  const agent = resolveAgent(config, options.agent);
  const provider = agent.provider ?? inferProvider(agent.model);
  const skillContent = readSkill(cwd, config.skills);
  const skillPath = resolve(cwd, config.skills);

  console.log(chalk.blue(`Running agent ${chalk.bold(agent.name)} locally`));
  console.log(chalk.dim(`Provider: ${provider} | Model: ${agent.model}`));
  console.log();

  const { cmd, args } = buildAgentCommand({
    provider,
    model: agent.model,
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
      printInstallHint(provider);
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
  provider: string;
  model: string;
  prompt: string;
  skillPath: string;
  cwd: string;
}): { cmd: string; args: string[] } {
  switch (opts.provider) {
    case "claude":
      return {
        cmd: "claude",
        args: [
          "-p",
          "--system-prompt-file",
          opts.skillPath,
          "--model",
          opts.model,
          "--dangerously-skip-permissions",
          opts.prompt,
        ],
      };

    case "openai":
      return {
        cmd: "codex",
        args: [
          "--quiet",
          "--full-auto",
          "--model",
          opts.model,
          opts.prompt,
        ],
      };

    case "opencode":
      return {
        cmd: "opencode",
        args: [
          "run",
          "--model",
          opts.model,
          opts.prompt,
        ],
      };

    default:
      // Default to claude
      return {
        cmd: "claude",
        args: [
          "-p",
          "--system-prompt-file",
          opts.skillPath,
          "--model",
          opts.model,
          "--dangerously-skip-permissions",
          opts.prompt,
        ],
      };
  }
}

function printInstallHint(provider: string) {
  switch (provider) {
    case "claude":
      console.error("  npm install -g @anthropic-ai/claude-code");
      break;
    case "openai":
      console.error("  npm install -g @openai/codex");
      break;
    case "opencode":
      console.error("  npm install -g opencode");
      break;
    default:
      console.error(`  Install the CLI for provider "${provider}"`);
  }
}
