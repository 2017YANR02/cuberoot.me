import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import process from 'node:process';

import { build, context } from 'esbuild';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const outputRoot = join(packageRoot, 'dist');
const projectConfigPath = join(packageRoot, 'project.config.json');
const watch = process.argv.includes('--watch');

async function existingAppId() {
  try {
    const config = JSON.parse(await readFile(projectConfigPath, 'utf8'));
    const appId = typeof config.appid === 'string' ? config.appid.trim() : '';
    return appId && appId !== 'touristappid' ? appId : '';
  } catch {
    return '';
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

async function prepareOutput() {
  await rm(outputRoot, { force: true, recursive: true });
  await mkdir(outputRoot, { recursive: true });
  const files = await walk(sourceRoot);
  await Promise.all(files
    .filter((file) => ['.json', '.wxml', '.wxss'].includes(extname(file)))
    .map(async (file) => {
      const target = join(outputRoot, relative(sourceRoot, file));
      await mkdir(dirname(target), { recursive: true });
      await copyFile(file, target);
    }));

  const templatePath = join(packageRoot, 'project.config.template.json');
  const config = JSON.parse(await readFile(templatePath, 'utf8'));
  config.appid =
    process.env.WECHAT_MINI_APP_ID?.trim() ||
    (await existingAppId()) ||
    'touristappid';
  await writeFile(
    projectConfigPath,
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  );
}

async function entryPoints() {
  const files = await walk(sourceRoot);
  return files.filter((file) => {
    if (extname(file) !== '.ts') return false;
    if (basename(file) === 'app.ts') return true;
    const sourcePath = relative(sourceRoot, file).replaceAll('\\', '/');
    return /^pages\/[^/]+\/index\.ts$/.test(sourcePath);
  });
}

await prepareOutput();

const options = {
  bundle: true,
  entryPoints: await entryPoints(),
  format: 'iife',
  logLevel: 'info',
  outbase: sourceRoot,
  outdir: outputRoot,
  platform: 'browser',
  sourcemap: true,
  target: 'es2020',
};

if (watch) {
  const buildContext = await context(options);
  await buildContext.watch();
  console.log('Watching mini program TypeScript. Restart after editing WXML, WXSS or JSON.');
} else {
  await build(options);
}
