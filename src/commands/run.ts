import chalk from "chalk";
import ora from "ora";
import { loadConfig, loadEnv, resolveAgent, type AgentConfig } from "../config.js";
import { getBox } from "../box.js";

interface RunOptions {
  agent?: string;
}

async function runOnAgent(agent: AgentConfig, prompt: string, apiKey: string): Promise<{ name: string; output: string; error?: string }> {
  const box = await getBox(agent.name, apiKey);
  if (!box) {
    return { name: agent.name, output: "", error: `Box "${agent.name}" not found. Run ${chalk.bold("ahi apply")} first.` };
  }
  await box.cd("/workspace/home");

  let output = "";
  const stream = await box.agent.stream({ prompt });
  for await (const chunk of stream) {
    if (chunk.type === "text-delta") {
      output += chunk.text;
    }
  }
  return { name: agent.name, output };
}

export async function runCommand(prompt: string, options: RunOptions) {
  const cwd = process.cwd();
  loadEnv(cwd);

  const config = loadConfig(cwd);

  const apiKey = process.env.UPSTASH_BOX_API_KEY;
  if (!apiKey) {
    console.error(chalk.red("UPSTASH_BOX_API_KEY is not set."));
    process.exit(1);
  }

  // If a specific agent is requested, run only on that agent
  if (options.agent) {
    const agent = resolveAgent(config, options.agent);
    return runSingleAgent(agent, prompt, apiKey);
  }

  // Run on all agents in parallel
  const agents = config.agents;
  const spinner = ora(`Running prompt on ${agents.length} agent(s)...`).start();

  try {
    const results = await Promise.all(
      agents.map((agent) => runOnAgent(agent, prompt, apiKey))
    );
    spinner.stop();

    for (const result of results) {
      console.log(chalk.blue(`\n${"─".repeat(40)}`));
      console.log(chalk.blue(`Agent: ${chalk.bold(result.name)}`));
      console.log(chalk.blue("─".repeat(40)));

      if (result.error) {
        console.error(chalk.red(result.error));
      } else {
        console.log(result.output);
      }
    }

    console.log(chalk.green("\nAll runs complete."));
  } catch (err: any) {
    spinner.stop();
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

async function runSingleAgent(agent: AgentConfig, prompt: string, apiKey: string) {
  const spinner = ora(`Connecting to box "${agent.name}"...`).start();

  try {
    const box = await getBox(agent.name, apiKey);
    if (!box) {
      spinner.stop();
      console.error(chalk.red(`Box "${agent.name}" not found. Run ${chalk.bold("ahi apply")} first.`));
      process.exit(1);
    }
    await box.cd("/workspace/home");
    spinner.stop();

    console.log(chalk.blue(`Running on ${chalk.bold(agent.name)}`));
    console.log(chalk.dim(`Model: ${agent.model}`));
    console.log();

    const stream = await box.agent.stream({ prompt });

    for await (const chunk of stream) {
      if (chunk.type === "text-delta") {
        process.stdout.write(chunk.text);
      }
    }

    console.log();
    console.log(chalk.green("\nRun complete."));
  } catch (err: any) {
    spinner.stop();
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}
