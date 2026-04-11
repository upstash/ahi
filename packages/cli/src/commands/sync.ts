import { resolve } from "path";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, loadEnv } from "../config.js";
import { getOrCreateBox, collectFiles } from "../box.js";

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
      ];

      if (files.length > 0) {
        await box.files.upload(files);
        spinner.succeed(`Uploaded ${files.length} files`);
      } else {
        spinner.warn("No files to upload");
      }

      // Sync schedules: delete existing, create new
      if (agent.schedules && agent.schedules.length > 0) {
        const scheduleSpinner = ora("Syncing schedules...").start();

        // Delete existing schedules
        const existingSchedules = await box.schedule.list();
        for (const schedule of existingSchedules) {
          await box.schedule.delete(schedule.id);
        }

        // Create new schedules
        for (const schedule of agent.schedules) {
          await box.schedule.agent({
            cron: schedule.cron,
            prompt: schedule.prompt,
            timeout: schedule.timeout,
          });
        }

        scheduleSpinner.succeed(
          `Synced ${agent.schedules.length} schedule(s)`,
        );
      }

      console.log(chalk.green(`  ${agent.name} synced.`));
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  }

  console.log(chalk.green("\nAll agents synced."));
}
