import { resolve, dirname } from "path";
import { mkdirSync, writeFileSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, loadEnv, resolveAgent } from "../config.js";
import { getBox } from "../box.js";

interface PullOptions {
  agent?: string;
}

export async function pullCommand(options: PullOptions) {
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
      spinner.fail(`Box "${agent.name}" not found. Run ${chalk.bold("ahi sync")} first.`);
      process.exit(1);
    }

    spinner.text = "Listing remote data files...";
    const files = await listFilesRecursive(box, "/workspace/home/data");

    if (files.length === 0) {
      spinner.warn("No data files found on the box");
      return;
    }

    spinner.text = `Downloading ${files.length} file(s)...`;
    let count = 0;

    for (const filePath of files) {
      const relativePath = filePath.replace("/workspace/home/", "");
      const localPath = resolve(cwd, relativePath);

      mkdirSync(dirname(localPath), { recursive: true });

      const content = await box.files.read(filePath);
      writeFileSync(localPath, content);
      count++;
    }

    spinner.succeed(`Pulled ${count} file(s) from "${agent.name}" to data/`);
  } catch (err: any) {
    spinner.fail(err.message);
    process.exit(1);
  }
}

async function listFilesRecursive(
  box: any,
  dir: string,
): Promise<string[]> {
  const entries = await box.files.list(dir);
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.is_dir) {
      paths.push(...(await listFilesRecursive(box, entry.path)));
    } else {
      paths.push(entry.path);
    }
  }

  return paths;
}
