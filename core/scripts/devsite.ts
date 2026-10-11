// Host-local project registry, compatible with the maintainer's existing devsite.
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

export type Project = { directory: string; url: string; command: string[] };
export const configPath = join(homedir(), '.config/devsite/projects.json');
export const binPath = process.platform === 'win32'
  ? join(process.env.APPDATA || join(homedir(), 'AppData/Roaming'), 'npm')
  : join(homedir(), '.local/bin');
export const launcherPath = join(homedir(), '.local/share/devsite/devsite.ts');
const marker = 'devsite-managed-launcher';

export function wrapper(script: string, node = process.execPath, windows = process.platform === 'win32'): string {
  if (windows) {
    // Reject cmd expansion characters; spaces and Unicode paths are supported.
    if (/[\r\n"%!]/.test(script + node)) throw Error('Unsupported characters in launcher path');
    return `@echo off\r\nrem ${marker}\r\n"${node}" "${script}" %*\r\n`;
  }
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  return `#!/bin/sh\n# ${marker}\nexec ${quote(node)} ${quote(script)} "$@"\n`;
}

export function projects(file = configPath): Record<string, Project> {
  if (!existsSync(file)) return {};
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (!data || Array.isArray(data) || typeof data !== 'object') throw Error('Invalid devsite registry');
  return data;
}

export function register(name: string, project: Project, file = configPath, bin = binPath, script = launcherPath) {
  if (!/^[a-z][a-z0-9-]*$/.test(name) || ['devsite', 'add', 'list', 'run', 'remove'].includes(name)) throw Error('Invalid project name');
  if (!existsSync(project.directory)) throw Error(`Project directory not found: ${project.directory}`);
  const url = new URL(project.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('Invalid preview URL');
  if (!project.command.length) throw Error('Missing startup command');
  const data = projects(file);
  // Re-running setup never overwrites a maintainer's domain or another checkout.
  if (data[name]) throw Error(`${name} is already registered. Existing configuration was preserved; run devsite list.`);
  const shortcut = join(bin, `${name}${process.platform === 'win32' ? '.cmd' : ''}`);
  try { lstatSync(shortcut); throw Error(`Command already exists: ${shortcut}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  mkdirSync(bin, { recursive: true });
  mkdirSync(dirname(file), { recursive: true });
  // The alias dispatches through the same registry on both operating systems.
  writeFileSync(shortcut, wrapper(script).replace(process.platform === 'win32' ? '%*' : '"$@"',
    process.platform === 'win32' ? `run ${name} %*` : `run ${name} "$@"`), { flag: 'wx', mode: 0o755 });
  data[name] = project;
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
}

async function main(args: string[]) {
  const [action, ...rest] = args;
  if (action === 'list') {
    for (const [name, p] of Object.entries(projects())) console.log(`${name}\t${p.url}\t${p.directory}`);
    return;
  }
  if (action === 'add') {
    if (rest[3] !== '--' || rest.length < 5) throw Error('devsite add NAME DIRECTORY URL -- COMMAND [ARGS]');
    register(rest[0], { directory: resolve(rest[1]), url: rest[2], command: rest.slice(4) });
    console.log(`Registered ${rest[0]}`); return;
  }
  const [name, ...extra] = action === 'run' ? rest : args;
  const p = projects()[name];
  if (!p) throw Error('Unknown project. Use devsite list or devsite add.');
  const child = spawn(p.command[0], [...p.command.slice(1), ...extra], { cwd: p.directory, stdio: 'inherit' });
  // The configured command owns browser readiness and process cleanup.
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
    // Console Ctrl+C already reaches the Windows child; let its cleanup run.
    if (process.platform !== 'win32' || signal !== 'SIGINT') child.kill(signal);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
