import { Box } from "@upstash/box";
import type { AgentConfig } from "./config.js";
import { resolveAgentApiKey } from "./config.js";
import { readdirSync, existsSync } from "fs";
import { resolve, relative, join } from "path";

/**
 * Find an existing box by agent name. Returns null if not found.
 */
export async function getBox(
  agentName: string,
  apiKey: string,
): Promise<InstanceType<typeof Box> | null> {
  const boxes = await Box.list({ apiKey });
  const existing = boxes.find((b) => b.name === agentName);

  if (!existing) {
    return null;
  }

  return Box.get(existing.id, { apiKey });
}

/**
 * Find a box by agent name or create one.
 */
export async function getOrCreateBox(
  agent: AgentConfig,
  apiKey: string,
): Promise<InstanceType<typeof Box>> {
  const boxes = await Box.list({ apiKey });
  const existing = boxes.find((b) => b.name === agent.name);

  if (existing) {
    const box = await Box.get(existing.id, { apiKey });
    console.log(`  Using existing box ${existing.id}`);
    return box;
  }

  const providerApiKey = resolveAgentApiKey(agent);
  const keyPreview = providerApiKey
    ? `"${providerApiKey.slice(0, 8)}..."`
    : "(none)";
  console.log(`  Creating new box | harness=${agent.harness} model=${agent.model} apiKey=${keyPreview}`);

  const box = await Box.create({
    apiKey,
    name: agent.name,
    runtime: "node",
    agent: {
      provider: agent.harness as any,
      model: agent.model as any,
      ...(providerApiKey && { apiKey: providerApiKey }),
    },
  });

  console.log(`  Box created: ${box.id}`);
  return box;
}

/**
 * Collect all files from a directory recursively, returning paths
 * suitable for box.files.upload().
 */
export function collectFiles(
  baseDir: string,
  subDir: string,
): { path: string; destination: string }[] {
  const fullDir = resolve(baseDir, subDir);
  const files: { path: string; destination: string }[] = [];

  try {
    const entries = readdirSync(fullDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(fullDir, entry.name);
      const dest = join("/workspace/home", subDir, entry.name);

      if (entry.isDirectory()) {
        files.push(
          ...collectFiles(baseDir, join(subDir, entry.name)),
        );
      } else if (entry.name !== ".gitkeep") {
        files.push({ path: fullPath, destination: dest });
      }
    }
  } catch {
    // Directory doesn't exist, skip
  }

  return files;
}

export function collectRootFiles(
  baseDir: string,
  filenames: string[],
): { path: string; destination: string }[] {
  return filenames
    .map((filename) => resolve(baseDir, filename))
    .filter((fullPath) => existsSync(fullPath))
    .map((fullPath) => ({
      path: fullPath,
      destination: join("/workspace/home", relative(baseDir, fullPath)),
    }));
}
