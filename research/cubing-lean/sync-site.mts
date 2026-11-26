// Export the published Lean declarations for the independently built static site.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('./', import.meta.url);
const output = new URL('../../core/packages/client/app/[lang]/math/cubing-lean/proofs.json', root);

function declaration(file: string, kind: 'def' | 'theorem', name: string) {
  const lines = readFileSync(new URL(file, root), 'utf8').split(/\r?\n/);
  const start = lines.findIndex(line => line.startsWith(`${kind} ${name} `));
  if (start < 0) throw new Error(`Missing ${kind} ${name} in ${file}`);
  let end = start + 1;
  while (end < lines.length && (!lines[end].trim() || /^\s/.test(lines[end]) || lines[end] === 'where')) end++;
  return { name, file, line: start + 1, source: lines.slice(start, end).join('\n').trimEnd() };
}

const excerpts = [
  ...['2011', '2026'].map(year => ({
    ...declaration('CubeDiameter/Main.lean', 'theorem', 'paper' + year),
    statement: declaration('CubeDiameter/Targets.lean', 'def', 'Paper' + year),
  })),
  declaration('CubeComm/Universal.lean', 'theorem', 'every_even_cube'),
];
const content = JSON.stringify(excerpts, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== content) throw new Error('Refresh the published declarations with node sync-site.mts');
} else {
  writeFileSync(output, content);
}
