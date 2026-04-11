import { Box } from "@upstash/box";
import type { BoxData } from "@upstash/box";
import { env } from "$env/dynamic/private";

function getApiKey(): string {
  const key = env.UPSTASH_BOX_API_KEY;
  if (!key) throw new Error("UPSTASH_BOX_API_KEY is not set");
  return key;
}

export async function listBoxes(): Promise<BoxData[]> {
  return Box.list({ apiKey: getApiKey() });
}

export async function getBox(id: string) {
  return Box.get(id, { apiKey: getApiKey() });
}

export async function getBoxData(id: string): Promise<BoxData | undefined> {
  const boxes = await listBoxes();
  return boxes.find((b) => b.id === id);
}
