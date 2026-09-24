#!/usr/bin/env node
/** Export saved Space scenes without modifying their authored .blend files. */
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '../../..');
const styles = ['modern', 'minimal', 'cyberpunk', 'vintage', 'italian', 'penthouse', 'japanese', 'company'];
const allKeys = ['shanghai', ...styles.flatMap((style) => [`${style}-original`, `${style}-island`, `${style}-shanghai`])];
const modes = new Set(['all', 'original', 'variants', 'city']);

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

const mode = option('--mode') ?? 'all';
const asset = option('--asset');
const previewCamera = option('--preview-camera');
const blender = option('--blender') ?? process.env.CUBEROOT_BLENDER ?? 'blender';
const plan = process.argv.includes('--plan');
if (!modes.has(mode)) throw new Error(`Unknown mode: ${mode}`);
if (asset && !allKeys.includes(asset)) throw new Error(`Unknown Space asset: ${asset}`);
if (previewCamera && !asset) throw new Error('--preview-camera requires --asset');
if (previewCamera && !/^[A-Za-z ]+$/.test(previewCamera)) {
  throw new Error('--preview-camera must be a camera name, for example Overview or Living room');
}
const keys = asset ? [asset] : mode === 'original' ? allKeys.filter((key) => key.endsWith('-original'))
  : mode === 'variants' ? allKeys.filter((key) => key.endsWith('-island') || key.endsWith('-shanghai'))
  : mode === 'city' ? ['shanghai'] : allKeys;
const logs = join(repository, '.tmp/png/space-blender');
const threads = availableParallelism();

for (const key of keys) {
  const blendPath = join(repository, 'design/space/scenes', `${key}.blend`);
  const script = join(here, previewCamera ? 'preview_scene.py' : 'export_scene.py');
  const args = ['--background', blendPath, '--threads', String(threads), '--python-exit-code', '1', '--python', script];
  if (previewCamera) args.push('--', '--camera', previewCamera);
  const logKey = previewCamera ? `${key}-preview` : key;
  if (plan) {
    console.log(`${key}: ${blender} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`);
    continue;
  }
  if (!existsSync(blendPath)) throw new Error(`Missing authored source: ${blendPath}. Restore its asset backup; batch export never regenerates authored models.`);
  mkdirSync(logs, { recursive: true });
  const stdout = openSync(join(logs, `${logKey}-process.log`), 'w');
  const stderr = openSync(join(logs, `${logKey}-error.log`), 'w');
  console.log(`START ${key}`);
  const code = await new Promise<number>((done, reject) => {
    const child = spawn(blender, args, { cwd: repository, stdio: ['ignore', stdout, stderr], windowsHide: true });
    child.once('error', reject);
    child.once('close', (exitCode) => done(exitCode ?? 1));
  }).finally(() => { closeSync(stdout); closeSync(stderr); });
  if (code !== 0) throw new Error(`Blender failed for ${key}; inspect ${logs}/${logKey}-process.log and ${logs}/${logKey}-error.log`);
  console.log(`DONE ${key}`);
}
