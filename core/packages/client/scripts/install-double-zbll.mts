/** Copy a verified offline job artifact into this application's public assets. */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOUBLE_ZBLL_RECORD_BYTES, type DoubleZbllManifest } from '@cuberoot/shared/double-zbll';
const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(client, '../../../.tmp/double-zbll-v1/export');
const destination = resolve(client, 'public/data/double-zbll');
const manifestBytes = readFileSync(resolve(source, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString()) as DoubleZbllManifest;
if (manifest.schema !== 1 || manifest.caseCount !== 472 || manifest.pairCount !== 222784
  || manifest.recordBytes !== DOUBLE_ZBLL_RECORD_BYTES || manifest.dataBytes !== 222784 * DOUBLE_ZBLL_RECORD_BYTES
  || !/^pairs-[a-f0-9]{16}\.bin$/.test(manifest.dataFile) || !/^cases-[a-f0-9]{16}\.json$/.test(manifest.casesFile)) throw new Error('Invalid Double ZBLL manifest');
const files = [[manifest.dataFile, manifest.dataSha256], [manifest.casesFile, manifest.casesSha256]].map(([name, sha]) => {
  const bytes = readFileSync(resolve(source, name));
  if (createHash('sha256').update(bytes).digest('hex') !== sha || (name === manifest.dataFile && bytes.length !== manifest.dataBytes)) throw new Error(`Invalid Double ZBLL artifact ${name}`);
  return { name, bytes };
});
mkdirSync(destination, { recursive: true });
for (const { name, bytes } of [...files, { name: 'manifest.json', bytes: manifestBytes }]) {
  writeFileSync(resolve(destination, name + '.tmp'), bytes);
  renameSync(resolve(destination, name + '.tmp'), resolve(destination, name));
}
console.log(`Installed ${manifest.pairCount} verified Double ZBLL records`);
