import chalk from "chalk";
import ora from "ora";
import { loadConfig, loadEnv, resolveAgent } from "../config.js";
import { getBox } from "../box.js";

interface RunOptions {
  agent?: string;
}

export async function runCommand(prompt: string, options: RunOptions) {
  const cwd = process.cwd();
  loadEnv(cwd);

  const config = loadConfig(cwd);
  const agent = resolveAgent(config, options.agent);

  const apiKey = process.env.UPSTASH_BOX_API_KEY;
  if (!apiKey) {
    console.error(chalk.red("UPSTASH_BOX_API_KEY is not set."));
    process.exit(1);
  }

  const spinner = ora(`Connecting to box "${agent.name}"...`).start();

  try {
    const box = await getBox(agent.name, apiKey);
    if (!box) {
      spinner.stop();
      console.error(chalk.red(`Box "${agent.name}" not found. Run ${chalk.bold("ahi sync")} first.`));
      process.exit(1);
    }
    await box.cd("/workspace/home");
    spinner.text = `Running prompt on "${agent.name}"...`;
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
