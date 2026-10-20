import { readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

/** Check transitive templates too: a native entry must not include a web shell. */
export async function validateNativePages(root, pages) {
  const visited = new Set();
  async function inspect(path) {
    const relativePath = relative(root, path);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error(`Template escapes bundle: ${path}`);
    if (visited.has(path)) return;
    visited.add(path);
    const source = (await readFile(path, 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
    if (/<web-view\b/i.test(source)) throw new Error(`Native page contains web-view: ${relativePath}`);
    for (const match of source.matchAll(/<(?:include|import)\b[^>]*\bsrc=["']([^"']+)["']/g)) {
      if (match[1].includes('{{')) throw new Error(`Dynamic template source: ${relativePath}`);
      await inspect(match[1].startsWith('/') ? resolve(root, '.' + match[1]) : resolve(dirname(path), match[1]));
    }
  }
  for (const page of pages) await inspect(resolve(root, `${page}.ttml`));
  // Include custom components and orphaned templates in the shipped package.
  // They need not be referenced by an include/import from a registered page.
  async function inspectDirectory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await inspectDirectory(path);
      else if (entry.isFile() && entry.name.endsWith('.ttml')) await inspect(path);
    }
  }
  await inspectDirectory(root);
}
