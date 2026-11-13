import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Read source-contract fixtures without executing modules. Follow only static
 * relative imports/re-exports inside explicitly supplied domain directories.
 *
 * @param {string | URL} entry
 * @param {{ roots?: readonly string[] }} options
 * @returns {string}
 */
export function readLocalModuleSource(entry, { roots = [] } = {}) {
  const prefixes = roots.map(root => resolve(root) + sep);
  const visited = new Set();
  function read(file) {
    const absolute = resolve(file);
    if (visited.has(absolute)) return '';
    visited.add(absolute);
    const source = readFileSync(absolute, 'utf8');
    const dependencies = [];
    // Only static relative imports/re-exports. Package and dynamic imports are excluded.
    const imports = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|[\w$]+(?:\s*,\s*\{[^}]*\})?)\s+from\s*['"](\.[^'"]+)['"]/g;
    for (const match of source.matchAll(imports)) {
      const path = resolve(dirname(absolute), match[1]);
      const extension = extname(path);
      if (extension && !['.js', '.mjs', '.ts', '.tsx'].includes(extension)) continue;
      const stem = path.replace(/\.(?:m?js|tsx?)$/, '');
      const candidates = extension === '.mjs'
        ? [path, `${stem}.mts`]
        : [`${stem}.ts`, `${stem}.tsx`, path, `${path}/index.ts`];
      const dependency = candidates.find(candidate => existsSync(candidate) && extname(candidate));
      if (!dependency) throw new Error(`Unresolved source import ${match[1]} in ${absolute}`);
      if (prefixes.some(prefix => resolve(dependency).startsWith(prefix))) dependencies.push(read(dependency));
    }
    return [source, ...dependencies].join('\n');
  }
  return read(entry instanceof URL ? fileURLToPath(entry) : entry);
}
