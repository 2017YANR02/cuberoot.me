import { resolve } from 'node:path';
import { resolveWorkspacePath } from '../../../scripts/resolve-workspace-path.mjs';

const CORE_ROOT = resolve(import.meta.dirname, '../../..');

export function workspaceFixturePath(packageName: string, ...segments: string[]): string {
  return resolve(CORE_ROOT, resolveWorkspacePath(packageName), ...segments);
}
