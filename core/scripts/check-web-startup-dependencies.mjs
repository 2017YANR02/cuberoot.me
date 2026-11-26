import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, findPackageJSON } from 'node:module';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkspacePath } from './resolve-workspace-path.mjs';

const packageName = '@app-foundation/ui-controls';
const opticsEntry = `${packageName}/glass-optics`;
const stylesheetEntry = `${packageName}/glass-surface.css`;
const core = resolve(import.meta.dirname, '..');

function uiControlsInstallation(workspace) {
  const consumer = join(workspace, resolveWorkspacePath('@cuberoot/app-ui', workspace), 'package.json');
  const specifier = JSON.parse(readFileSync(consumer, 'utf8')).dependencies?.[packageName];
  let manifestPath;
  try {
    manifestPath = findPackageJSON(packageName, consumer);
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  }
  const version = manifestPath && JSON.parse(readFileSync(manifestPath, 'utf8')).version;
  const tarball = specifier?.startsWith('file:') ? basename(specifier.slice(5)) : undefined;
  const matchesPin = Boolean(specifier && version && (!tarball || tarball === `app-foundation-ui-controls-${version}.tgz`));
  return { consumer, specifier, version, matchesPin };
}

export function checkWebStartupDependencies(workspace = core) {
  const { consumer, specifier, version, matchesPin } = uiControlsInstallation(workspace);
  if (!matchesPin) {
    throw new Error(`${packageName}: installed ${version ?? 'missing'}, app-ui declares ${specifier ?? 'no dependency'}. Check package.json and pnpm-lock.yaml.`);
  }

  try {
    const require = createRequire(consumer);
    const optics = require(opticsEntry);
    for (const component of ['GlassOptics', 'SiteGlassOptics']) {
      if (typeof optics[component] !== 'function') throw new Error(`${opticsEntry} does not export ${component}`);
    }
    const stylesheet = readFileSync(require.resolve(stylesheetEntry), 'utf8');
    for (const token of ['--af-glass-panel-bg:', '--af-glass-backdrop:']) {
      if (!stylesheet.includes(token)) throw new Error(`${stylesheetEntry} does not define ${token.slice(0, -1)}`);
    }
  } catch (error) {
    throw new Error(`Web startup dependency ${packageName}@${version}: ${error.message}. Update the packed dependency and pnpm-lock.yaml together.`, { cause: error });
  }
}

export function prepareWebStartupDependencies(workspace, requiredFiles, stdio) {
  const lockfile = readFileSync(join(workspace, 'pnpm-lock.yaml'), 'utf8').replaceAll('\r\n', '\n');
  const installedLockPath = join(workspace, 'node_modules', '.pnpm', 'lock.yaml');
  const installedLockfile = existsSync(installedLockPath)
    ? readFileSync(installedLockPath, 'utf8').replaceAll('\r\n', '\n')
    : undefined;

  if (installedLockfile !== lockfile || requiredFiles.some(file => !existsSync(file)) || !uiControlsInstallation(workspace).matchesPin) {
    console.log('Installing CubeRoot dependencies from pnpm-lock.yaml…');
    execFileSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], {
      cwd: workspace,
      stdio,
      shell: process.platform === 'win32',
    });
  }
  checkWebStartupDependencies(workspace);
  if (requiredFiles.some(file => !existsSync(file))) throw new Error('Next.js or Turbo is still missing after the frozen install.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkWebStartupDependencies();
    console.log('Web startup dependency exports and stylesheet are available.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
