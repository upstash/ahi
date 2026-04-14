import { resolve } from "path";
import { existsSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, loadEnv, resolveAgentStrict } from "../config.js";
import type { AgentConfig } from "../config.js";
import { getBox, collectFiles } from "../box.js";

interface PushOptions {
  agent?: string;
  all?: boolean;
}

export async function pushDataCommand(options: PushOptions) {
  const cwd = process.cwd();
  loadEnv(cwd);

  const config = loadConfig(cwd);

  const apiKey = process.env.UPSTASH_BOX_API_KEY;
  if (!apiKey) {
    console.error(chalk.red("UPSTASH_BOX_API_KEY is not set."));
    process.exit(1);
  }

  const dataDir = resolve(cwd, "data");
  if (!existsSync(dataDir)) {
    console.error(chalk.red("No data/ directory found."));
    process.exit(1);
  }

  const agents: AgentConfig[] = options.all
    ? config.agents
    : [resolveAgentStrict(config, options.agent)];

  for (const agent of agents) {
    const spinner = ora(`Connecting to box "${agent.name}"...`).start();

    try {
      const box = await getBox(agent.name, apiKey);
      if (!box) {
        spinner.fail(`Box "${agent.name}" not found. Run ${chalk.bold("ahi apply")} first.`);
        process.exit(1);
      }

      spinner.text = "Collecting data files...";
      const files = collectFiles(cwd, "data");

      if (files.length === 0) {
        spinner.warn("No files found in data/");
        return;
      }

      spinner.text = `Uploading ${files.length} file(s)...`;
      await box.files.upload(files);

      spinner.succeed(`Pushed ${files.length} data file(s) to "${agent.name}"`);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  }
}

export const pushCommand = pushDataCommand;
