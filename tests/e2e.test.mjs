import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = resolve(repoRoot, "dist/cli.js");

function runCli(args, cwd = repoRoot, env = process.env) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env,
  });
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
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
  assert.match(ahiYaml, /^    harness: claude-code$/m);
  assert.match(ahiYaml, /^    model: anthropic\/claude-sonnet-4-6$/m);

  const envExample = readFileSync(resolve(projectDir, ".env.example"), "utf8");
  assert.match(envExample, /^OPENCODE_API_KEY=$/m);
  assert.doesNotMatch(envExample, /^GOOGLE_API_KEY=$/m);

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

test("harness values are explicit and authoritative", () => {
  const skillsSource = readFileSync(resolve(repoRoot, "src", "skills.ts"), "utf8");
  const configSource = readFileSync(resolve(repoRoot, "src", "config.ts"), "utf8");
  const boxSource = readFileSync(resolve(repoRoot, "src", "box.ts"), "utf8");

  assert.match(configSource, /AGENT_HARNESSES = \["claude-code", "codex", "opencode"\]/);
  assert.match(configSource, /missing required field "harness"/);
  assert.doesNotMatch(configSource, /inferProvider/);
  assert.match(skillsSource, /harness === "claude-code"/);
  assert.match(skillsSource, /harness === "codex"/);
  assert.match(skillsSource, /harness === "opencode"/);
  assert.match(skillsSource, /return "AGENTS\.md";/);
  assert.match(skillsSource, /return "\.agents\/skills";/);
  assert.match(boxSource, /provider: agent\.harness as any/);
  assert.doesNotMatch(boxSource, /inferDefaultProvider/);
  assert.match(configSource, /model\.startsWith\("anthropic\/"\)/);
  assert.match(configSource, /model\.startsWith\("openai\/"\)/);
  assert.match(configSource, /model\.startsWith\("openrouter\/"\)/);
  assert.match(configSource, /model\.startsWith\("opencode\/"\)/);
  assert.doesNotMatch(configSource, /switch \(agent\.harness\)/);
  assert.match(configSource, /OPENROUTER_API_KEY/);
  assert.match(configSource, /OPENCODE_API_KEY/);
});

test("commands fail fast when an agent harness is missing", () => {
  const projectDir = mkdtempSync(resolve(tmpdir(), "ahi-harness-e2e-"));

  writeFileSync(
    resolve(projectDir, "ahi.yaml"),
    `tools: ./tools/\nskills: ./skills/SKILL.md\n\nagents:\n  - name: broken-agent\n    model: anthropic/claude-sonnet-4-6\n`,
  );

  mkdirSync(resolve(projectDir, "skills"), { recursive: true });
  writeFileSync(resolve(projectDir, "skills", "SKILL.md"), "# Runtime Skill\n");

  const result = runCli(["apply"], projectDir);

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /missing required field "harness"/);
});

test("ahi dev runs with a local dev agent even without ahi.yaml", () => {
  const projectDir = mkdtempSync(resolve(tmpdir(), "ahi-dev-e2e-"));
  const binDir = resolve(projectDir, "bin");
  mkdirSync(binDir, { recursive: true });

  writeFileSync(
    resolve(projectDir, "AGENTS.md"),
    "# Local Dev Instructions\n",
  );

  mkdirSync(resolve(projectDir, "skills"), { recursive: true });
  writeFileSync(resolve(projectDir, "skills", "SKILL.md"), "# Runtime Skill\n");

  const fakeCodexPath = resolve(binDir, "codex");
  writeFileSync(
    fakeCodexPath,
    "#!/bin/sh\nprintf 'FAKE_CODEX %s\\n' \"$*\"\n",
  );
  chmodSync(fakeCodexPath, 0o755);

  const result = runCli(
    ["dev", "test local dev"],
    projectDir,
    {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    },
  );

  const stdout = stripAnsi(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.match(stdout, /Running agent local locally/);
  assert.match(stdout, /Harness: codex \| Model: local default/);
  assert.match(stdout, /FAKE_CODEX/);
  assert.doesNotMatch(result.stderr, /ahi\.yaml not found/);
});
