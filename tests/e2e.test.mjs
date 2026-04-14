import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = resolve(repoRoot, "dist/cli.js");

function runCli(args, cwd = repoRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("CLI help exposes the primary command surface", () => {
  const result = runCli(["--help"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\binit\b/);
  assert.match(result.stdout, /\bdev\b/);
  assert.match(result.stdout, /\brun\b/);
  assert.match(result.stdout, /\bapply\b/);
  assert.match(result.stdout, /\bpull-data\b/);
  assert.match(result.stdout, /\bpush-data\b/);
  assert.match(result.stdout, /\bsync\b/);
  assert.match(result.stdout, /\bpull\b/);
  assert.match(result.stdout, /\bpush\b/);
});

test("ahi init scaffolds local dev instructions and runtime skill entrypoint", () => {
  const projectDir = mkdtempSync(resolve(tmpdir(), "ahi-e2e-"));

  const initResult = runCli(["init"], projectDir);
  assert.equal(initResult.status, 0, initResult.stderr);

  const requiredPaths = [
    "ahi.yaml",
    ".env.example",
    "CLAUDE.md",
    "AGENTS.md",
    "tools/note.ts",
    "skills/SKILL.md",
    "data/.gitkeep",
  ];

  for (const relativePath of requiredPaths) {
    assert.ok(existsSync(resolve(projectDir, relativePath)), `missing ${relativePath}`);
  }

  const ahiYaml = readFileSync(resolve(projectDir, "ahi.yaml"), "utf8");
  assert.match(ahiYaml, /^skills: \.\/skills\/SKILL\.md$/m);

  const agentsMd = readFileSync(resolve(projectDir, "AGENTS.md"), "utf8");
  assert.match(agentsMd, /This file is for local development only\./);
  assert.match(agentsMd, /Ahi does not upload `AGENTS\.md` to remote boxes\./);
  assert.match(agentsMd, /`skills\/SKILL\.md` defines deployed runtime behavior\./);
  assert.match(agentsMd, /Test changes locally with `ahi dev` before using `ahi apply`\./);
  assert.match(agentsMd, /`ahi pull-data` or `ahi push-data`/);
  assert.match(agentsMd, /Do not assume `AGENTS\.md` is available inside the remote box\./);

  const claudeMd = readFileSync(resolve(projectDir, "CLAUDE.md"), "utf8");
  assert.match(claudeMd, /^@skills\/SKILL\.md$/m);
  assert.match(claudeMd, /This file is for local development only\./);
  assert.match(claudeMd, /`skills\/SKILL\.md` defines deployed runtime behavior\./);
  assert.match(claudeMd, /Do not assume `CLAUDE\.md` is available inside the remote box\./);

  const skillMd = readFileSync(resolve(projectDir, "skills", "SKILL.md"), "utf8");
  assert.match(skillMd, /# Notes Skill/);
  assert.match(skillMd, /npx tsx \/workspace\/home\/tools\/note\.ts add <text>/);

  const secondInitResult = runCli(["init"], projectDir);
  assert.equal(secondInitResult.status, 0, secondInitResult.stderr);
  assert.match(secondInitResult.stdout, /ahi\.yaml already exists\. Skipping init\./);
});

test("subcommand help reflects the renamed data transfer commands", () => {
  const pullHelp = runCli(["pull-data", "--help"]);
  assert.equal(pullHelp.status, 0, pullHelp.stderr);
  assert.match(pullHelp.stdout, /Download data\/ from an agent box to local/);
  assert.match(pullHelp.stdout, /--agent <name>/);

  const pushHelp = runCli(["push-data", "--help"]);
  assert.equal(pushHelp.status, 0, pushHelp.stderr);
  assert.match(pushHelp.stdout, /Upload local data\/ to agent boxes/);
  assert.match(pushHelp.stdout, /--agent <name>/);
  assert.match(pushHelp.stdout, /--all/);
});
