import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import chalk from "chalk";
import { loadEnv } from "../config.js";

interface ConsoleOptions {
  port: string;
}

export async function consoleCommand(options: ConsoleOptions) {
  const cwd = process.cwd();
  loadEnv(cwd);

  const apiKey = process.env.UPSTASH_BOX_API_KEY;
  if (!apiKey) {
    console.error(chalk.red("UPSTASH_BOX_API_KEY is not set."));
    process.exit(1);
  }

  // The console app is bundled in the packages/console directory
  // For now, resolve relative to this CLI package
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const consolePath = resolve(__dirname, "../../console");

  console.log(chalk.blue(`Starting Ahi Console on port ${options.port}...`));
  console.log(chalk.dim(`http://localhost:${options.port}`));
  console.log();

  const child = spawn("node", ["build/index.js"], {
    cwd: consolePath,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: options.port,
      UPSTASH_BOX_API_KEY: apiKey,
    },
  });

  child.on("error", (err) => {
    console.error(chalk.red(`Failed to start console: ${err.message}`));
    console.error(
      chalk.dim("Make sure the console is built: pnpm --filter console build"),
    );
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}
