import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const source = readFileSync(join(repo, 'ops/nginx/purge-api-cache.ts'), 'utf8');
const temporary: string[] = [];
const hash = '0123456789abcdef0123456789abcdef';

function fixture() {
  // macOS /var is a symlink; the production guard deliberately rejects aliases.
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'nginx-cache-purge-')));
  temporary.push(base);
  const cache = join(base, 'api');
  const leaf = join(cache, 'f', 'de');
  mkdirSync(leaf, { recursive: true });
  return { base, cache, leaf };
}

function purge(cache: string) {
  // Substitute only in this isolated test copy. Production has no path override.
  const input = source.replace("const cacheRoot = '/var/cache/nginx/api';", `const cacheRoot = ${JSON.stringify(cache)};`);
  if (input === source || !temporary.some(base => cache.startsWith(`${base}/`))) {
    throw new Error('Test purge must stay inside a registered temporary fixture');
  }
  return spawnSync(process.execPath, ['--input-type=module'], { input, encoding: 'utf8', timeout: 10_000 });
}

afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe.skipIf(process.platform === 'win32')('nginx API cache purge', () => {
  it('removes only cache files while preserving directories, active writes and outside data', () => {
    const { base, cache, leaf } = fixture();
    const cached = join(leaf, hash);
    const activeWrite = `${cached}.0000000001`;
    const outside = join(base, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, hash), 'outside data');
    writeFileSync(cached, 'old cache');
    writeFileSync(activeWrite, 'active nginx temporary file');
    writeFileSync(join(leaf, 'keep.txt'), 'non-cache data');
    symlinkSync(join(outside, hash), join(leaf, 'a'.repeat(32)));
    symlinkSync(outside, join(cache, 'f', 'ab'));
    mkdirSync(join(leaf, 'b'.repeat(32)));
    const result = purge(cache);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(existsSync(cached)).toBe(false);
    expect(readFileSync(activeWrite, 'utf8')).toBe('active nginx temporary file');
    expect(readFileSync(join(leaf, 'keep.txt'), 'utf8')).toBe('non-cache data');
    expect(readFileSync(join(outside, hash), 'utf8')).toBe('outside data');
    expect(lstatSync(join(leaf, 'a'.repeat(32))).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(cache, 'f', 'ab')).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(leaf, 'b'.repeat(32))).isDirectory()).toBe(true);
    expect(lstatSync(leaf).isDirectory()).toBe(true);
    expect(purge(cache).status).toBe(0);
  });

  it('refuses a symlink at the cache root or any parent', () => {
    const { base, cache, leaf } = fixture();
    writeFileSync(join(leaf, hash), 'preserve');
    const rootLink = join(base, 'root-link');
    const parentLink = join(base, 'parent-link');
    symlinkSync(cache, rootLink);
    symlinkSync(base, parentLink);
    expect(purge(rootLink).status).toBe(1);
    expect(purge(join(parentLink, 'api')).status).toBe(1);
    expect(readFileSync(join(leaf, hash), 'utf8')).toBe('preserve');
  });

  it('fails closed for missing or non-directory roots', () => {
    const { base } = fixture();
    expect(purge(join(base, 'missing')).status).toBe(1);
    const file = join(base, 'file');
    writeFileSync(file, 'preserve');
    expect(purge(file).status).toBe(1);
    expect(readFileSync(file, 'utf8')).toBe('preserve');
  });

  it.skipIf(process.getuid?.() === 0)('reports permission errors instead of hiding them', () => {
    const { cache, leaf } = fixture();
    writeFileSync(join(leaf, hash), 'preserve');
    chmodSync(leaf, 0o500);
    try {
      const result = purge(cache);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('API cache purge failed');
      expect(readFileSync(join(leaf, hash), 'utf8')).toBe('preserve');
    } finally {
      chmodSync(leaf, 0o700);
    }
  });

  it('finishes while a separate process continues writing cache files', async () => {
    const { cache, leaf } = fixture();
    for (let i = 0; i < 1000; i++) writeFileSync(join(leaf, i.toString(16).padStart(32, '0')), 'old');
    const writer = spawn(process.execPath, ['--input-type=module', '-e', `
      import { writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      let n = 0;
      setInterval(() => {
        writeFileSync(join(process.argv[1], (n++ % 1000).toString(16).padStart(32, '0')), 'new');
        if (n === 1) process.stdout.write('ready');
      }, 1);
      process.on('SIGTERM', () => { console.log('writes=' + n); process.exit(0); });
    `, leaf], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    writer.stdout.on('data', data => { output += String(data); });
    try {
      await once(writer.stdout, 'data');
      expect(purge(cache).status).toBe(0);
      expect(lstatSync(leaf).isDirectory()).toBe(true);
    } finally {
      const closed = once(writer, 'close');
      writer.kill('SIGTERM');
      await closed;
    }
    expect(Number(output.match(/writes=(\d+)/)?.[1])).toBeGreaterThan(1);
  });

  it('both workflows stream the same guarded script without discarding stdin', () => {
    for (const name of ['stats.yml', 'deploy_core.yml']) {
      const workflow = readFileSync(join(repo, '.github/workflows', name), 'utf8');
      expect(workflow).not.toContain('rm -rf /var/cache/nginx/api');
      expect(workflow).toContain("'node --input-type=module' < ops/nginx/purge-api-cache.ts");
      const invocation = workflow.match(/ssh[^\n]*(?:\\\n[^\n]*)*'node --input-type=module' < ops\/nginx\/purge-api-cache\.ts/)?.[0];
      expect(invocation).toBeDefined();
      expect(invocation).not.toMatch(/\s-n(?:\s|$)/);
      expect(invocation).toContain('ServerAliveInterval=30');
      expect(invocation).toContain('ServerAliveCountMax=3');
    }
  });
});
