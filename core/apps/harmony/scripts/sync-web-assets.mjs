import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(projectDir, 'dist');
const targetDir = resolve(projectDir, 'entry/src/main/resources/rawfile/app');
const expectedSuffix = ['entry', 'src', 'main', 'resources', 'rawfile', 'app'].join(sep);

if (!targetDir.endsWith(expectedSuffix)) {
  throw new Error(`Refusing to replace unexpected resource directory: ${targetDir}`);
}

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });
await cp(sourceDir, targetDir, { recursive: true });

const worker = await stat(resolve(targetDir, 'cubing-chunks/search-worker-entry.js'));
if (!worker.isFile() || worker.size === 0) {
  throw new Error('Harmony rawfiles must include the shared cubing search worker');
}
