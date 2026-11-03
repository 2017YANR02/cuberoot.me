import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Build for the current host. CI packages Linux native binaries in the same release as the worker.
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(app, 'dist/photo-runtime');
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const copied = new Map<string, string>();
function copyDependency(name: string, requireFrom: ReturnType<typeof createRequire>, optional = false) {
  let manifest: string;
  try { manifest = requireFrom.resolve(`${name}/package.json`); }
  catch {
    const installed = requireFrom.resolve.paths(name)?.map(base => join(base, name, 'package.json')).find(existsSync);
    if (installed) manifest = installed;
    else {
      let entry: string;
      try { entry = requireFrom.resolve(name); } catch (error) { if (optional) return; throw error; }
      let dir = dirname(realpathSync(entry));
      while (!existsSync(join(dir, 'package.json')) || JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name !== name) {
        if (dirname(dir) === dir) throw new Error(`Missing runtime manifest: ${name}`);
        dir = dirname(dir);
      }
      manifest = join(dir, 'package.json');
    }
  }
  manifest = realpathSync(manifest);
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  if (copied.has(name)) {
    if (copied.get(name) !== pkg.version) throw new Error(`Conflicting runtime dependency: ${name}`);
    return;
  }
  copied.set(name, pkg.version);
  cpSync(dirname(manifest), join(out, 'node_modules', name), { recursive: true, dereference: true, filter: path => basename(path) !== 'node_modules' });
  const child = createRequire(manifest);
  for (const dependency of Object.keys(pkg.dependencies ?? {})) copyDependency(dependency, child);
  for (const dependency of Object.keys(pkg.optionalDependencies ?? {})) copyDependency(dependency, child, true);
}
copyDependency('sharp', createRequire(join(app, 'package.json')));
await build({ entryPoints: [join(app, 'src/utils/cube_photo_worker.ts')], outfile: join(out, 'worker.mjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'esm', external: ['sharp'] });
console.log(`Photo worker built with ${copied.size} runtime packages (${process.platform}/${process.arch}).`);
// Fail the artifact build if native binaries or transitive runtime files are missing.
const runtimeSharp = createRequire(join(out, 'worker.mjs'))('sharp') as typeof import('sharp');
await runtimeSharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer();
