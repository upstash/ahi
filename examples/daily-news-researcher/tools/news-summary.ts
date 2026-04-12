import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const command = process.argv[2];
const date = process.argv[3];
const summary = process.argv.slice(4).join(" ").trim();

const dataDir = resolve(process.cwd(), "data");
const summaryPath = resolve(dataDir, "daily-summary.md");

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
}

function readEntries() {
  if (!existsSync(summaryPath)) {
    return [];
  }

  const content = readFileSync(summaryPath, "utf8").trim();
  if (!content) {
    return [];
  }

  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(/^- /, ""));
}

function writeEntries(entries: string[]) {
  const content =
    entries.length > 0 ? entries.map((entry) => `- ${entry}`).join("\n") + "\n" : "";
  writeFileSync(summaryPath, content);
}

ensureDataDir();

switch (command) {
  case "save": {
    if (!date || !summary) {
      console.log("Usage: npx tsx tools/news-summary.ts save <YYYY-MM-DD> <summary>");
      process.exit(1);
    }

    const entries = readEntries();
    const nextEntry = `${date}: ${summary}`;
    const existingIndex = entries.findIndex((entry) => entry.startsWith(`${date}: `));

    if (existingIndex >= 0) {
      entries[existingIndex] = nextEntry;
      writeEntries(entries);
      console.log(`Updated summary for ${date}.`);
      break;
    }

    entries.push(nextEntry);
    writeEntries(entries);
    console.log(`Saved summary for ${date}.`);
    break;
  }

  case "list": {
    const entries = readEntries();
    if (entries.length === 0) {
      console.log("No summaries saved.");
      break;
    }

    console.log(entries.map((entry, index) => `${index + 1}. ${entry}`).join("\n"));
    break;
  }

  case "latest": {
    const entries = readEntries();
    if (entries.length === 0) {
      console.log("No summaries saved.");
      break;
    }

    console.log(entries[entries.length - 1]);
    break;
  }

  default:
    console.log("Usage: npx tsx tools/news-summary.ts <save|list|latest> [args]");
}
