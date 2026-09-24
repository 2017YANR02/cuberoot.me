/** Fetch the public recon backup in the scheduled GitHub workflow. */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const dest = path.join(repoRoot, 'data/recon_backup/recons_backup.json');
const response = await fetch('https://api.cuberoot.me/v1/recon/list', { signal: AbortSignal.timeout(60_000) });
if (!response.ok) throw new Error(`Recon backup HTTP ${response.status}`);
const data: unknown = await response.json();
if (!Array.isArray(data) && (!data || typeof data !== 'object')) throw new Error('Recon backup response is not a list or object');
const count = Array.isArray(data) ? data.length : Object.keys(data).length;
await mkdir(path.dirname(dest), { recursive: true });
await writeFile(`${dest}.tmp`, `${JSON.stringify(data, null, 4)}\n`, 'utf8');
await rename(`${dest}.tmp`, dest);
console.log(`Fetched ${count} recons`);
