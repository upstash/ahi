import { resolve } from "path";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, loadEnv } from "../config.js";
import { getOrCreateBox, collectFiles, collectRootFiles } from "../box.js";

const ROOT_RUNTIME_FILES = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "tsconfig.json",
  "jsconfig.json",
  ".npmrc",
];

export async function syncCommand() {
  const cwd = process.cwd();
  loadEnv(cwd);

  const config = loadConfig(cwd);

  const apiKey = process.env.UPSTASH_BOX_API_KEY;
  if (!apiKey) {
    console.error(chalk.red("UPSTASH_BOX_API_KEY is not set."));
    process.exit(1);
  }

  for (const agent of config.agents) {
    console.log(chalk.blue(`\nSyncing agent ${chalk.bold(agent.name)}...`));

    const spinner = ora("Connecting to box...").start();

    try {
      const box = await getOrCreateBox(agent, apiKey);

      // Collect files to upload
      spinner.text = "Uploading files...";

      const files = [
        ...collectFiles(cwd, "tools"),
        ...collectFiles(cwd, "skills"),
        { path: resolve(cwd, "ahi.yaml"), destination: "/workspace/home/ahi.yaml" },
        ...collectRootFiles(cwd, ROOT_RUNTIME_FILES),
      ];

      if (files.length > 0) {
        await box.files.upload(files);
        spinner.succeed(`Uploaded ${files.length} files`);
      } else {
        spinner.warn("No files to upload");
      }

      if (config.setup && config.setup.length > 0) {
        const setupSpinner = ora("Running setup...").start();

        for (const command of config.setup) {
          setupSpinner.text = `Running setup: ${command}`;
          const result = await box.exec.command(`cd /workspace/home && ${command}`);

          if (result.exit_code !== 0) {
            setupSpinner.fail(`Setup failed: ${command}`);

            if (result.output) {
              console.error(result.output);
            }

            if (result.error) {
              console.error(result.error);
            }

            process.exit(1);
          }
        }

        setupSpinner.succeed(`Ran ${config.setup.length} setup command(s)`);
      }

      const scheduleSpinner = ora("Syncing schedules...").start();
      const existingSchedules = await box.schedule.list();
      for (const schedule of existingSchedules) {
        await box.schedule.delete(schedule.id);
      }

      for (const schedule of agent.schedules ?? []) {
        await box.schedule.agent({
          cron: schedule.cron,
          prompt: schedule.prompt,
          timeout: schedule.timeout,
        });
      }

      scheduleSpinner.succeed(
        `Synced ${(agent.schedules ?? []).length} schedule(s)`,
      );

      console.log(chalk.green(`  ${agent.name} synced.`));
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  }

  console.log(chalk.green("\nAll agents synced."));
}
