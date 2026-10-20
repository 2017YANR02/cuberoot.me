import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { buildWechatBundle } from '../scripts/build-wechat-bundle.mjs';

it.each([false, true])('loads shared native modules once and preserves page handlers (maps=%s)', async (sourcemap) => {
  const root = await mkdtemp(join(tmpdir(), 'wechat-bundle-'));
  try {
    const src = join(root, 'src');
    await mkdir(src);
    await writeFile(join(src, 'state.ts'), 'export const state = { count: 0 }; export const increment = () => ++state.count;');
    await writeFile(join(src, 'app.ts'), "import { increment } from './state'; App({ onLaunch: increment });");
    await writeFile(join(src, 'page.ts'), "import { state, increment } from './state'; Page({ data: state, onTap: increment });");
    const result = await buildWechatBundle({
      absWorkingDir: root, entryPoints: [join(src, 'app.ts'), join(src, 'page.ts')],
      outbase: src, outdir: join(root, 'dist'), bundle: true, metafile: true,
      platform: 'browser', target: 'chrome91', sourcemap,
    });
    const sources = new Map(await Promise.all(result.outputFiles.map(async file => [file.path, await readFile(file.path, 'utf8')])));
    const cache = new Map();
    let app; let page;
    const load = (path) => {
      if (cache.has(path)) return cache.get(path).exports;
      const module = { exports: {} }; cache.set(path, module);
      runInNewContext(sources.get(path), {
        module, exports: module.exports,
        require: specifier => load(resolve(dirname(path), specifier)),
        App: value => { app = value; }, Page: value => { page = value; },
      });
      return module.exports;
    };
    load(join(root, 'dist/app.js')); app.onLaunch();
    load(join(root, 'dist/page.js'));
    expect(page.data.count).toBe(1);
    expect(page.onTap()).toBe(2);
    expect(page.data.count).toBe(2);
    expect([...sources.keys()].some(path => path.includes(`${sep}shared${sep}`))).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
