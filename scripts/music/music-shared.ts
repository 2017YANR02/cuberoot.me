import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve, sep } from 'node:path';

export const GIB = 1024 ** 3;
export const MIB = 1024 ** 2;
export const SHA256 = /^[a-f0-9]{64}$/;

export function within(root: string, candidate: string): boolean {
  const base = resolve(root);
  const full = resolve(candidate);
  const compare = process.platform === 'win32' ? (s: string) => s.toLowerCase() : (s: string) => s;
  return compare(full) === compare(base) || compare(full).startsWith(compare(`${base}${sep}`));
}

export function assertOutsideSource(source: string, target: string, label: string): void {
  if (within(source, target)) throw new Error(`${label} must not be inside the read-only source tree.`);
}

export async function fileSha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export function textSha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function writeJsonAtomic(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return;
  const part = join(dirname(file), `${file.split(/[\\/]/).at(-1)}.part.${randomUUID()}`);
  try {
    writeFileSync(part, content, 'utf8');
    renameSync(part, file);
  } catch (error) {
    throw error;
  }
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function nonempty(value: unknown): string | undefined {
  const result = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  return result || undefined;
}

export function number(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function validateArgs(args: string[], switches: string[], valued: string[]): void {
  const flags = new Set(switches);
  const values = new Set(valued);
  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (flags.has(token)) continue;
    if (values.has(token)) {
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${token} requires a value.`);
      index++;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
}

export function requireFile(file: string): void {
  if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`Missing file: ${file}`);
}

export function runSync(command: string, args: string[], options: { input?: string; cwd?: string } = {}): string {
  const executable = /\.[cm]?js$/.test(command) ? process.execPath : command;
  const actualArgs = executable === process.execPath ? [command, ...args] : args;
  const result = spawnSync(executable, actualArgs, { encoding: 'utf8', input: options.input, cwd: options.cwd, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status ?? 'spawn'}): ${(result.stderr || result.stdout || result.error?.message || '').trim()}`);
  return result.stdout;
}

export function runAsync(command: string, args: string[], options: { cwd?: string; input?: string } = {}): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const executable = /\.[cm]?js$/.test(command) ? process.execPath : command;
    const actualArgs = executable === process.execPath ? [command, ...args] : args;
    const child = spawn(executable, actualArgs, { cwd: options.cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (part: string) => { stdout += part; });
    child.stderr.on('data', (part: string) => { stderr += part; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolveOutput(stdout) : reject(new Error(`${command} failed (${code}): ${stderr.trim() || stdout.trim()}`)));
    child.stdin.end(options.input ?? '');
  });
}
