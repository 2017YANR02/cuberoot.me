import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ARCHITECTURE_EDGES,
  ARCHITECTURE_IGNORED_UNIT_PATHS,
  ARCHITECTURE_NODES,
} from '../app/[lang]/dev/architecture/_lib/architecture-map';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const mappedPaths = new Set(ARCHITECTURE_NODES.flatMap((node) => node.sourcePaths));

function unitPaths(parent: string) {
  return readdirSync(join(REPO_ROOT, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${parent}/${entry.name}`);
}

describe('architecture map', () => {
  it('covers every active app, package, and job directory', () => {
    const activeUnits = ['core/apps', 'core/packages', 'core/jobs']
      .flatMap(unitPaths)
      .filter((path) => !ARCHITECTURE_IGNORED_UNIT_PATHS.includes(path));

    expect(activeUnits.filter((path) => !mappedPaths.has(path))).toEqual([]);
    expect([...mappedPaths].filter((path) => !existsSync(join(REPO_ROOT, path)))).toEqual([]);
  });

  it('keeps node ids and edges valid', () => {
    const ids = ARCHITECTURE_NODES.map((node) => node.id);
    const idSet = new Set(ids);

    expect(idSet.size).toBe(ids.length);
    expect(ARCHITECTURE_EDGES.filter((edge) => !idSet.has(edge.from) || !idSet.has(edge.to))).toEqual([]);
  });

  it('does not publish technology versions', () => {
    expect(JSON.stringify(ARCHITECTURE_NODES)).not.toMatch(/(?:React|Next(?:\.js)?|Node|PostgreSQL|Capacitor|Tauri|Hono)\s+v?\d/i);
  });
});
