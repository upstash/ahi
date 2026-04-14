import { program } from "commander";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { runCommand } from "./commands/run.js";
import { syncCommand } from "./commands/sync.js";
import { pullCommand } from "./commands/pull.js";
import { pushCommand } from "./commands/push.js";


function getVersion() {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packageJson = readFileSync(resolve(__dirname, "../package.json"), "utf-8");
    return JSON.parse(packageJson).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

program
  .name("ahi")
  .description("Framework for running independent agents")
  .version(getVersion());

program
  .command("init")
  .description("Scaffold the folder structure")
  .action(initCommand);

program
  .command("dev")
  .description("Run an agent locally")
  .argument("<prompt>", "The prompt for the agent")
  .option("--agent <name>", "Agent name from ahi.yaml")
  .action(devCommand);

program
  .command("run")
  .description("Run an agent remotely on the Box")
  .argument("<prompt>", "The prompt for the agent")
  .option("--agent <name>", "Agent name from ahi.yaml")
  .action(runCommand);

program
  .command("sync")
  .description("Push local files, setup, and schedules to the Box")
  .action(syncCommand);

program
  .command("pull")
  .description("Download data/ from the Box to local")
  .option("--agent <name>", "Agent name from ahi.yaml")
  .action(pullCommand);

program
  .command("push")
  .description("Upload local data/ to the Box")
  .option("--agent <name>", "Agent name from ahi.yaml")
  .option("--all", "Push to all agents")
  .action(pushCommand);

program.parse();
