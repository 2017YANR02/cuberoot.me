import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../../packages/client/package.json', import.meta.url));
const nextRoot = dirname(require.resolve('next/package.json'));
const scratch = fileURLToPath(new URL('../../../.tmp/scratch/', import.meta.url));
const count = 8;

// Execute the installed Next implementation, not a duplicate of the patch.
// Force async readers to share the same snapshot: the old implementation loses
// routes (or corrupts JSON); synchronous read/modify/write preserves every route.
async function exercise(source: string) {
  const start = source.indexOf('const rawExistingManifest =');
  const end = source.indexOf('\n            }\n            this.staticPathsCache', start);
  assert.ok(start >= 0 && end > start, 'Review this regression when upgrading Next');
  fs.mkdirSync(scratch, { recursive: true });
  const dir = fs.mkdtempSync(join(scratch, 'prerender-race-'));
  try {
    const manifest = join(dir, 'prerender-manifest.json');
    fs.writeFileSync(manifest, JSON.stringify({ version: 4, routes: {}, dynamicRoutes: {}, notFoundRoutes: [] }));
    const readers: (() => void)[] = [];
    const fileApi = {
      ...fs,
      promises: {
        ...fs.promises,
        readFile: (path: string, encoding: BufferEncoding) => {
          const snapshot = fs.readFileSync(path, encoding);
          return new Promise<string>(resolve => {
            readers.push(() => resolve(snapshot));
            if (readers.length === count) readers.forEach(release => release());
          });
        },
      },
    };
    const fallbackModeToFallbackField = () => null;
    const getRouteRegex = (path: string) => ({ re: new RegExp(path) });
    const apply = runInNewContext(`(async function(value, pathname, page, res) {
      const prerenderRouteMatchers = [], prerenderedRoutes = [];
      ${source.slice(start, end)}
    })`, {
      _fs: { default: fileApi }, fs: fileApi,
      _path: { join }, pathJoin: join,
      _constants1: { PRERENDER_MANIFEST: 'prerender-manifest.json' }, PRERENDER_MANIFEST: 'prerender-manifest.json',
      _fallback: { fallbackModeToFallbackField }, fallbackModeToFallbackField,
      _routeregex: { getRouteRegex }, getRouteRegex,
    });
    const results = await Promise.allSettled(Array.from({ length: count }, (_, i) => {
      const page = `/[lang]/page-${i}`;
      return apply.call({ distDir: dir }, { staticPaths: [`/zh/page-${i}`, `/en/page-${i}`] }, page, page, { value: { fallbackMode: 0 } });
    }));
    for (const result of results) assert.equal(result.status, 'fulfilled');
    const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    assert.equal(Object.keys(parsed.routes).length, count * 2);
    assert.equal(Object.keys(parsed.dynamicRoutes).length, count);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

for (const format of ['dist', 'dist/esm']) {
  test(`${format}: concurrent prerender updates retain every language and page`, async () => {
    const source = fs.readFileSync(join(nextRoot, format, 'server/dev/next-dev-server.js'), 'utf8');
    await exercise(source);
  });
}

// A negative control proves the concurrent test catches the original lost-update bug.
test('original asynchronous update fails the same concurrency check', async () => {
  const source = fs.readFileSync(join(nextRoot, 'dist/server/dev/next-dev-server.js'), 'utf8')
    .replace('const rawExistingManifest = _fs.default.readFileSync(', 'const rawExistingManifest = await _fs.default.promises.readFile(')
    .replace('_fs.default.writeFileSync((0, _path.join)(this.distDir, _constants1.PRERENDER_MANIFEST), updatedManifest)', 'await _fs.default.promises.writeFile((0, _path.join)(this.distDir, _constants1.PRERENDER_MANIFEST), updatedManifest)');
  await assert.rejects(exercise(source));
});
