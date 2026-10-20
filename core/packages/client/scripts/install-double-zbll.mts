/** Copy a verified offline job artifact into this application's public assets. */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeDoubleZbll, validDoubleZbllManifest, type DoubleZbllManifest } from '@cuberoot/shared/double-zbll';
const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// An explicit directory also accepts verified incremental AUF exports.
const source = process.argv[2] ? resolve(process.argv[2]) : resolve(client, '../../../.tmp/double-zbll-v1/export');
const destination = resolve(client, 'public/data/double-zbll');
const manifestBytes = readFileSync(resolve(source, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString()) as DoubleZbllManifest;
if (!validDoubleZbllManifest(manifest)) throw new Error('Invalid Double ZBLL manifest');
const files = [[manifest.dataFile, manifest.dataSha256], [manifest.casesFile, manifest.casesSha256]].map(([name, sha]) => {
  const bytes = readFileSync(resolve(source, name));
  if (createHash('sha256').update(bytes).digest('hex') !== sha || (name === manifest.dataFile && bytes.length !== manifest.dataBytes)) throw new Error(`Invalid Double ZBLL artifact ${name}`);
  return { name, bytes };
});
const data=files[0].bytes,cases=JSON.parse(files[1].bytes.toString()).cases;
if(cases.length!==manifest.caseCount || new Set(cases.map((c:any)=>`${c.subgroup}|${c.name}`)).size!==manifest.caseCount
  || (manifest.caseCount===493 && cases.some((c:any,i:number)=>c.subgroup.startsWith('PLL/')!==(i>=472)))) throw Error('Invalid Double ZBLL cases');
for(let i=0;i<manifest.pairCount;i++)decodeDoubleZbll(data,manifest.caseCount,Math.floor(i/manifest.caseCount),i%manifest.caseCount);
mkdirSync(destination, { recursive: true });
for (const { name, bytes } of [...files, { name: 'manifest.json', bytes: manifestBytes }]) {
  writeFileSync(resolve(destination, name + '.tmp'), bytes);
  renameSync(resolve(destination, name + '.tmp'), resolve(destination, name));
}
console.log(`Installed ${manifest.pairCount} verified Double ZBLL records`);
