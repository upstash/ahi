import { program } from "commander";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { runCommand } from "./commands/run.js";
import { syncCommand } from "./commands/sync.js";
import { consoleCommand } from "./commands/console.js";

program
  .name("ahi")
  .description("Framework for running independent agents")
  .version("0.1.0");

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
  .description("Push local files and schedules to the Box")
  .action(syncCommand);

program
  .command("console")
  .description("Open the monitoring dashboard")
  .option("--port <port>", "Port to serve on", "3456")
  .action(consoleCommand);

program.parse();
