import { resolve } from "path";
import { existsSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, loadEnv, inferProvider } from "../config.js";
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

      // Write .env inside the box if env vars are configured
      if (config.env && Object.keys(config.env).length > 0) {
        const envSpinner = ora("Writing box .env...").start();
        const envLines: string[] = [];
        for (const [key, value] of Object.entries(config.env)) {
          if (value != null) {
            envLines.push(`${key}=${value}`);
          } else if (process.env[key]) {
            envLines.push(`${key}=${process.env[key]}`);
          }
        }
        if (envLines.length > 0) {
          await box.files.write({
            path: "/workspace/home/.env",
            content: envLines.join("\n") + "\n",
          });
          envSpinner.succeed(`Wrote ${envLines.length} env var(s) to box`);
        } else {
          envSpinner.warn("No env values found in local environment");
        }
      }

      // Copy skill to provider-specific root paths so agents auto-load it
      const provider = agent.provider ?? inferProvider(agent.model);
      const skillFilePath = resolve(cwd, config.skills);
      if (existsSync(skillFilePath)) {
        const rootSkillFiles: { path: string; destination: string }[] = [];
        if (provider === "claude") {
          rootSkillFiles.push({ path: skillFilePath, destination: "/workspace/home/CLAUDE.md" });
        } else if (provider === "openai" || provider === "opencode") {
          rootSkillFiles.push({ path: skillFilePath, destination: "/workspace/home/AGENTS.md" });
        }
        if (rootSkillFiles.length > 0) {
          await box.files.upload(rootSkillFiles);
        }
      }

      // Ensure data directory exists on the Box
      await box.exec.command("mkdir -p /workspace/home/data");

      if (config.setup && config.setup.length > 0) {
        const setupSpinner = ora("Running setup...").start();

        for (const command of config.setup) {
          setupSpinner.text = `Running setup: ${command}`;
          const result = await box.exec.command(`cd /workspace/home && ${command}`);

          if (result.exitCode !== 0) {
            setupSpinner.fail(`Setup failed: ${command}`);

            if (result.result) {
              console.error(result.result);
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
          folder: "home",
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
