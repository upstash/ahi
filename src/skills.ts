import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { relative, resolve, sep, dirname } from "path";
import { collectFiles } from "./box.js";

function resolveProviderRootInstructionFilename(provider: string): string | null {
  if (provider === "claude") {
    return "CLAUDE.md";
  }

  if (provider === "openai" || provider === "opencode") {
    return "AGENTS.md";
  }

  return null;
}

export function resolveLocalInstructionPath(
  provider: string,
  cwd: string,
  configuredSkillPath: string,
): string {
  const rootInstructionFilename = resolveProviderRootInstructionFilename(provider);
  if (rootInstructionFilename) {
    const rootInstructionPath = resolve(cwd, rootInstructionFilename);
    if (existsSync(rootInstructionPath)) {
      return rootInstructionPath;
    }
  }

  return resolve(cwd, configuredSkillPath);
}

export function collectRootInstructionUploadFiles(
  cwd: string,
  provider: string,
  configuredSkillPath: string,
): { path: string; destination: string }[] {
  const rootInstructionFilename = resolveProviderRootInstructionFilename(provider);
  if (!rootInstructionFilename) {
    return [];
  }

  const rootInstructionPath = resolve(cwd, configuredSkillPath);

  if (!existsSync(rootInstructionPath)) {
    return [];
  }

  return [
    {
      path: rootInstructionPath,
      destination: `/workspace/home/${rootInstructionFilename}`,
    },
  ];
}

export function collectNativeSkillUploadFiles(
  cwd: string,
  provider: string,
): { path: string; destination: string }[] {
  const nativeRoot = resolveProviderNativeSkillRoot(provider);
  if (!nativeRoot) {
    return [];
  }

  return collectNativeSkillFiles(cwd, nativeRoot, "remote");
}

export function prepareLocalSkills(
  cwd: string,
  provider: string,
  configuredSkillPath: string,
): string {
  const nativeRoot = resolveProviderNativeSkillRoot(provider);
  if (nativeRoot) {
    const files = collectNativeSkillFiles(cwd, nativeRoot, "local");
    for (const file of files) {
      mkdirSync(dirname(file.destination), { recursive: true });
      copyFileSync(file.path, file.destination);
    }
  }

  return resolveLocalInstructionPath(provider, cwd, configuredSkillPath);
}

function resolveProviderNativeSkillRoot(provider: string): string | null {
  if (provider === "claude") {
    return ".claude/skills";
  }

  if (provider === "openai" || provider === "opencode") {
    return ".agents/skills";
  }

  return null;
}

function collectNativeSkillFiles(
  cwd: string,
  nativeRoot: string,
  mode: "local" | "remote",
): { path: string; destination: string }[] {
  const skillsDir = resolve(cwd, "skills");
  if (!existsSync(skillsDir)) {
    return [];
  }

  const packageRoots = findSkillPackageRoots(skillsDir);

  return packageRoots.flatMap((packageRoot) => {
    const packageName = relativeSkillPackageName(skillsDir, packageRoot);

    return collectFiles(packageRoot, "").map((file) => {
      const relativePath = file.destination.replace("/workspace/home/", "");
      const destination =
        mode === "remote"
          ? `${nativeRoot}/${packageName}/${relativePath}`
          : resolve(cwd, nativeRoot, packageName, relativePath);

      return {
        path: file.path,
        destination,
      };
    });
  });
}

function findSkillPackageRoots(skillsDir: string): string[] {
  const packageRoots: string[] = [];

  const rootSkillPath = resolve(skillsDir, "SKILL.md");
  const nestedSkillDirs = findNestedSkillDirectories(skillsDir);

  if (existsSync(rootSkillPath) && nestedSkillDirs.length === 0) {
    packageRoots.push(skillsDir);
  }

  packageRoots.push(...nestedSkillDirs);

  return packageRoots;
}

function findNestedSkillDirectories(dir: string): string[] {
  const packageRoots: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fullPath = resolve(dir, entry.name);
    if (existsSync(resolve(fullPath, "SKILL.md"))) {
      packageRoots.push(fullPath);
      continue;
    }

    packageRoots.push(...findNestedSkillDirectories(fullPath));
  }

  return packageRoots;
}

function relativeSkillPackageName(skillsDir: string, packageRoot: string): string {
  if (packageRoot === skillsDir) {
    return "default";
  }

  return relative(skillsDir, packageRoot).split(sep).join("/");
}
