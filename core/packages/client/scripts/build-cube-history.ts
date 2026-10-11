import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { CUBES, SOURCES } from '../app/[lang]/cube-history/_data/catalog-source';
import { encodeCatalog } from '../app/[lang]/cube-history/_data/catalog-codec';
const source = { CUBES, SOURCES };
const content = JSON.stringify(encodeCatalog(source)) + '\n';
const target = fileURLToPath(new URL('../app/[lang]/cube-history/_data/catalog.compact.json', import.meta.url));
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== content) throw new Error('Cube history catalog is stale. Run build:cube-history.');
} else writeFileSync(target, content);
console.log(JSON.stringify({ records: CUBES.length, before: Buffer.byteLength(JSON.stringify(source)), after: Buffer.byteLength(content), gzipBefore: gzipSync(JSON.stringify(source)).length, gzipAfter: gzipSync(content).length }));
