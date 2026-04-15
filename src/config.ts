import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { config as loadDotenv } from "dotenv";

export const AGENT_HARNESSES = ["claude-code", "codex", "opencode"] as const;
export type AgentHarness = (typeof AGENT_HARNESSES)[number];

export interface ScheduleConfig {
  cron: string;
  prompt: string;
  timeout?: number;
}

export interface AgentConfig {
  name: string;
  model: string;
  harness: AgentHarness;
  schedules?: ScheduleConfig[];
}

export interface AhiConfig {
  tools: string;
  skills: string;
  env?: Record<string, string | null>;
  setup?: string[];
  agents: AgentConfig[];
}

export interface AhiDevConfig {
  tools?: string;
  skills: string;
  env?: Record<string, string | null>;
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

  validateAgents(config.agents);

  if (config.setup && !Array.isArray(config.setup)) {
    throw new Error("ahi.yaml field \"setup\" must be an array of commands");
  }

  return config;
}

/**
 * Load ahi.yaml for local development. Falls back to defaults when absent and
 * does not require agent definitions.
 */
export function loadDevConfig(cwd: string = process.cwd()): AhiDevConfig {
  const configPath = resolve(cwd, "ahi.yaml");
  if (!existsSync(configPath)) {
    return {
      skills: "./skills/SKILL.md",
      agents: [],
    };
  }

  const raw = readFileSync(configPath, "utf-8");
  const config = (yaml.load(raw) as Partial<AhiConfig> | undefined) ?? {};

  if (config.setup && !Array.isArray(config.setup)) {
    throw new Error("ahi.yaml field \"setup\" must be an array of commands");
  }

  if (Array.isArray(config.agents)) {
    validateAgents(config.agents);
  }

  return {
    tools: config.tools,
    skills: config.skills ?? "./skills/SKILL.md",
    env: config.env,
    setup: config.setup,
    agents: Array.isArray(config.agents) ? config.agents : [],
  };
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
 * Resolve an agent by name, requiring explicit selection when multiple agents exist.
 */
export function resolveAgentStrict(
  config: AhiConfig,
  agentName?: string,
): AgentConfig {
  if (config.agents.length > 1 && !agentName) {
    const names = config.agents.map((a) => a.name).join(", ");
    throw new Error(`Multiple agents defined. Use --agent <name> to select one. Available: ${names}`);
  }
  return resolveAgent(config, agentName);
}

/**
 * Validate configured agents and require an explicit harness.
 */
export function validateAgents(agents: AgentConfig[]): void {
  for (const agent of agents) {
    if (!agent.harness) {
      throw new Error(
        `Agent "${agent.name}" is missing required field "harness". Allowed values: ${AGENT_HARNESSES.join(", ")}`,
      );
    }

    if (!AGENT_HARNESSES.includes(agent.harness)) {
      throw new Error(
        `Agent "${agent.name}" has invalid harness "${agent.harness}". Allowed values: ${AGENT_HARNESSES.join(", ")}`,
      );
    }
  }
}

/**
 * Resolve the agent API key from environment variables.
 */
export function resolveAgentApiKey(agent: AgentConfig): string | undefined {
  if (agent.model.startsWith("openrouter/")) {
    return process.env.OPENROUTER_API_KEY;
  }

  if (agent.model.startsWith("anthropic/")) {
    return process.env.ANTHROPIC_API_KEY;
  }

  if (agent.model.startsWith("openai/")) {
    return process.env.OPENAI_API_KEY;
  }

  if (agent.model.startsWith("opencode/")) {
    return process.env.OPENCODE_API_KEY;
  }

  return undefined;
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
