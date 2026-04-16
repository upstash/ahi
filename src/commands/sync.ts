import { resolve } from "path";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, loadEnv } from "../config.js";
import { getOrCreateBox, collectFiles, collectRootFiles } from "../box.js";
import { collectNativeSkillUploadFiles, collectRootInstructionUploadFiles } from "../skills.js";

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

export async function applyCommand() {
  const cwd = process.cwd();
  loadEnv(cwd);

  const config = loadConfig(cwd);

  const apiKey = process.env.UPSTASH_BOX_API_KEY;
  if (!apiKey) {
    console.error(chalk.red("UPSTASH_BOX_API_KEY is not set."));
    process.exit(1);
  }

  for (const agent of config.agents) {
    console.log(chalk.blue(`\nApplying local project to agent ${chalk.bold(agent.name)}...`));

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

      // Project the configured runtime skill into the harness root filename on the box.
      const rootSkillFiles = collectRootInstructionUploadFiles(
        cwd,
        agent.harness,
        config.skills,
      );
      if (rootSkillFiles.length > 0) {
        await box.files.upload(rootSkillFiles);
      }

      const nativeSkillFiles = collectNativeSkillUploadFiles(cwd, agent.harness);
      if (nativeSkillFiles.length > 0) {
        await box.files.upload(nativeSkillFiles);
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

      const scheduleSpinner = ora("Applying schedules...").start();
      const existingSchedules = await box.schedule.list();
      for (const schedule of existingSchedules) {
        await box.schedule.delete(schedule.id);
      }

      for (const schedule of agent.schedules ?? []) {
        await box.schedule.agent({
          cron: schedule.cron,
          prompt: schedule.prompt,
          timeout: schedule.timeout,
          folder: schedule.folder ?? "/workspace/home",
        });
      }

      scheduleSpinner.succeed(
        `Applied ${(agent.schedules ?? []).length} schedule(s)`,
      );

      console.log(chalk.green(`  ${agent.name} updated.`));
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  }

  console.log(chalk.green("\nApplied local project to all agents."));
}

export const syncCommand = applyCommand;
