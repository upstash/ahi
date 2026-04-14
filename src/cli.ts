import { program } from "commander";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { runCommand } from "./commands/run.js";
import { applyCommand } from "./commands/sync.js";
import { pullDataCommand, pullCommand } from "./commands/pull.js";
import { pushDataCommand, pushCommand } from "./commands/push.js";


function getVersion() {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packageJson = readFileSync(resolve(__dirname, "../package.json"), "utf-8");
    return JSON.parse(packageJson).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function warnDeprecated(command: string, replacement: string) {
  console.warn(`Deprecated: ${command} is now ${replacement}`);
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
  .command("apply")
  .description("Apply local project files, setup, and schedules to all agent boxes")
  .action(applyCommand);

program
  .command("pull-data")
  .description("Download data/ from an agent box to local")
  .option("--agent <name>", "Agent name from ahi.yaml")
  .action(pullDataCommand);

program
  .command("push-data")
  .description("Upload local data/ to agent boxes")
  .option("--agent <name>", "Agent name from ahi.yaml")
  .option("--all", "Push to all agents")
  .action(pushDataCommand);

program
  .command("sync")
  .description("Deprecated alias for apply")
  .action(() => {
    warnDeprecated("ahi sync", "ahi apply");
    return applyCommand();
  });

program
  .command("pull")
  .description("Deprecated alias for pull-data")
  .option("--agent <name>", "Agent name from ahi.yaml")
  .action((options) => {
    warnDeprecated("ahi pull", "ahi pull-data");
    return pullCommand(options);
  });

program
  .command("push")
  .description("Deprecated alias for push-data")
  .option("--agent <name>", "Agent name from ahi.yaml")
  .option("--all", "Push to all agents")
  .action((options) => {
    warnDeprecated("ahi push", "ahi push-data");
    return pushCommand(options);
  });

program.parse();
