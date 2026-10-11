import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { binPath, configPath, launcherPath, projects, register, wrapper } from './devsite.ts';

const core = resolve(import.meta.dirname, '..');
if (!['darwin', 'win32'].includes(process.platform)) throw Error('This setup supports macOS and Windows.');
if (Number(process.versions.node.split('.')[0]) < 24) throw Error('Install Node.js 24 or newer first.');
if (!existsSync(join(core, 'packages/client/node_modules/next'))) throw Error('Run pnpm install in core first.');
if (projects().cuberoot) {
  console.log(`cuberoot is already registered: ${projects().cuberoot.url}\nExisting settings were preserved.`);
  process.exit(0);
}

const devsite = join(binPath, process.platform === 'win32' ? 'devsite.cmd' : 'devsite');
const shortcut = join(binPath, process.platform === 'win32' ? 'cuberoot.cmd' : 'cuberoot');
try { lstatSync(shortcut); throw Error(`Command already exists: ${shortcut}. No settings changed.`); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const project = { directory: core, url: 'http://127.0.0.1:3000/zh', command: [process.execPath, join(core, 'scripts/local-dev.ts')] };

if (existsSync(devsite)) {
  // Use the existing host tool's registration API, including the Python launcher.
  if (process.platform === 'win32') throw Error('An existing devsite was found. Register this project with devsite add; see docs/development.md.');
  execFileSync(devsite, ['add', 'cuberoot', core, project.url, '--', ...project.command], { stdio: 'inherit' });
} else {
  mkdirSync(dirname(launcherPath), { recursive: true });
  mkdirSync(binPath, { recursive: true });
  copyFileSync(join(core, 'scripts/devsite.ts'), launcherPath);
  writeFileSync(devsite, wrapper(launcherPath), { mode: 0o755, flag: 'wx' });
  register('cuberoot', project);
}

if (process.platform === 'darwin') {
  const profile = join(homedir(), '.zshrc');
  const line = 'export PATH="$HOME/.local/bin:$PATH"';
  if (!(existsSync(profile) && readFileSync(profile, 'utf8').includes(line))) appendFileSync(profile, `\n# devsite shortcuts\n${line}\n`);
  console.log('Open a new Terminal window, then run: cuberoot');
} else {
  console.log(`Open a new terminal and run: cuberoot\nIf the command is not found, add this folder to your user Path in Windows Environment Variables:\n${binPath}`);
}
console.log(`Registry: ${configPath}\nNo DNS, tunnel or database was configured. Keep the terminal open while developing.`);
