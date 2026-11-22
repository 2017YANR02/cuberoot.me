import { execFileSync } from 'node:child_process';
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('../', import.meta.url));
const dist = join(packageDir, 'dist');
const scratch = join(packageDir, '../../../.tmp/scratch');
const { name, version, description, license, repository, type, sideEffects, types, exports } =
  JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
const packageManifest = {
  name, version, description, license, repository, type, sideEffects, types, exports,
};

await mkdir(scratch, { recursive: true });
const stage = await mkdtemp(join(scratch, 'cuberoot-js-pack-'));
try {
  const stageDist = join(stage, 'dist');
  await mkdir(stageDist);
  const artifacts = (await readdir(dist)).filter(file => /\.(?:js|js\.map|d\.ts|wasm)$/.test(file));
  await Promise.all([
    writeFile(join(stage, 'package.json'), `${JSON.stringify(packageManifest, null, 2)}\n`),
    copyFile(join(packageDir, 'README.md'), join(stage, 'README.md')),
    copyFile(join(dist, 'LICENSE'), join(stage, 'LICENSE')),
    copyFile(join(dist, 'THIRD_PARTY_NOTICES.md'), join(stage, 'THIRD_PARTY_NOTICES.md')),
    cp(join(dist, 'licenses'), join(stage, 'licenses'), { recursive: true }),
    ...artifacts.map(file => copyFile(join(dist, file), join(stageDist, file))),
  ]);
  const output = execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', dist, '--json'], {
    cwd: stage,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const [{ filename }] = JSON.parse(output);
  process.stdout.write(`${join(dist, filename)}\n`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
