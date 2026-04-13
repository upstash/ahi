import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { config as loadDotenv } from "dotenv";

export interface ScheduleConfig {
  cron: string;
  prompt: string;
  timeout?: number;
}

export interface AgentConfig {
  name: string;
  model: string;
  provider?: string;
  schedules?: ScheduleConfig[];
}

export interface AhiConfig {
  tools: string;
  skills: string;
  setup?: string[];
  agents: AgentConfig[];
}

/**
 * Find and parse ahi.yaml from the current directory.
 */
export function loadConfig(cwd: string = process.cwd()): AhiConfig {
  const configPath = resolve(cwd, "ahi.yaml");
  if (!existsSync(configPath)) {
    throw new Error(`ahi.yaml not found in ${cwd}`);
  }
  const raw = readFileSync(configPath, "utf-8");
  const config = yaml.load(raw) as AhiConfig;

  if (!config.agents || config.agents.length === 0) {
    throw new Error("ahi.yaml must define at least one agent");
  }

  if (config.setup && !Array.isArray(config.setup)) {
    throw new Error("ahi.yaml field \"setup\" must be an array of commands");
  }

  return config;
}

/**
 * Load .env if present, then validate required env vars.
 */
export function loadEnv(cwd: string = process.cwd()): void {
  const envPath = resolve(cwd, ".env");
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath });
  }
}

/**
 * Resolve an agent by name or return the first one.
 */
export function resolveAgent(
  config: AhiConfig,
  agentName?: string,
): AgentConfig {
  if (agentName) {
    const agent = config.agents.find((a) => a.name === agentName);
    if (!agent) {
      const names = config.agents.map((a) => a.name).join(", ");
      throw new Error(`Agent "${agentName}" not found. Available: ${names}`);
    }
    return agent;
  }
  return config.agents[0];
}

/**
 * Infer the provider from a model string.
 */
export function inferProvider(model: string): string {
  if (model.startsWith("claude") || model.includes("claude")) return "claude";
  if (model.startsWith("gpt") || model.includes("openai")) return "openai";
  if (model.startsWith("gemini") || model.includes("gemini")) return "gemini";
  if (model.startsWith("opencode/")) return "opencode";
  return "claude";
}

/**
 * Read the skill file content.
 */
export function readSkill(cwd: string, skillPath: string): string {
  const resolved = resolve(cwd, skillPath);
  if (!existsSync(resolved)) {
    throw new Error(`Skill file not found: ${resolved}`);
  }
  return readFileSync(resolved, "utf-8");
}
