import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_CONTAINERS = ['apps', 'packages', 'jobs'];

export function resolveWorkspacePath(packageName, coreRoot = CORE_ROOT) {
  const matches = [];

  for (const container of WORKSPACE_CONTAINERS) {
    const containerRoot = join(coreRoot, container);
    if (!existsSync(containerRoot)) continue;

    for (const entry of readdirSync(containerRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const workspaceRoot = join(containerRoot, entry.name);
      const manifestPath = join(workspaceRoot, 'package.json');
      if (!existsSync(manifestPath)) continue;

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.name === packageName) matches.push(workspaceRoot);
    }
  }

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one workspace named ${packageName}, found ${matches.length}`);
  }

  return relative(coreRoot, matches[0]).replaceAll('\\', '/');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packageName = process.argv[2];
  if (!packageName) throw new Error('Usage: node scripts/resolve-workspace-path.mjs <package-name>');
  process.stdout.write(resolveWorkspacePath(packageName));
}
