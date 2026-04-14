import { spawn } from "child_process";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, loadEnv, resolveAgent, inferProvider, type AgentConfig } from "../config.js";
import { prepareLocalSkills } from "../skills.js";

interface DevOptions {
  agent?: string;
}

function runAgentLocally(agent: AgentConfig, config: { skills: string }, prompt: string, cwd: string): Promise<{ name: string; output: string; error?: string }> {
  const provider = agent.provider ?? inferProvider(agent.model);
  const skillPath = prepareLocalSkills(cwd, provider, config.skills);

  const { cmd, args } = buildAgentCommand({
    provider,
    model: agent.model,
    prompt,
    skillPath,
    cwd,
  });

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({ name: agent.name, output: "", error: `"${cmd}" not found. Install it first.` });
      } else {
        resolve({ name: agent.name, output: "", error: err.message });
      }
    });

    child.on("exit", (code) => {
      if (code !== 0 && stderr) {
        resolve({ name: agent.name, output: stdout, error: stderr });
      } else {
        resolve({ name: agent.name, output: stdout });
      }
    });
  });
}

export async function devCommand(prompt: string, options: DevOptions) {
  const cwd = process.cwd();
  loadEnv(cwd);

  const config = loadConfig(cwd);

  // If a specific agent is requested, run only that one with inherited stdio
  if (options.agent) {
    const agent = resolveAgent(config, options.agent);
    return runSingleAgentDev(agent, config, prompt, cwd);
  }

  // Run all agents in parallel
  const agents = config.agents;
  const spinner = ora(`Running prompt on ${agents.length} agent(s) locally...`).start();

  const results = await Promise.all(
    agents.map((agent) => runAgentLocally(agent, config, prompt, cwd))
  );
  spinner.stop();

  for (const result of results) {
    console.log(chalk.blue(`\n${"─".repeat(40)}`));
    console.log(chalk.blue(`Agent: ${chalk.bold(result.name)}`));
    console.log(chalk.blue("─".repeat(40)));

    if (result.error) {
      console.error(chalk.red(result.error));
    }
    if (result.output) {
      console.log(result.output);
    }
  }

  console.log(chalk.green("\nAll runs complete."));
}

function runSingleAgentDev(agent: AgentConfig, config: { skills: string }, prompt: string, cwd: string) {
  const provider = agent.provider ?? inferProvider(agent.model);
  const skillPath = prepareLocalSkills(cwd, provider, config.skills);

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
