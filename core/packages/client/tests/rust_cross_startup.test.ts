import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { expect, it, vi } from 'vitest';

const assets = path.resolve(__dirname, '../../../../tools/solver/rust-cross');
const source = readFileSync(path.join(assets, 'cross-solver-worker.js'), 'utf8');
const table = readFileSync(path.join(assets, 'tables/pt_cross.bin.gz'));
const glueUrl = 'https://app.example/tools/solver/rust-cross/cross_solver.js?v=test';
const wasmUrl = 'https://app.example/tools/solver/rust-cross/cross_solver_bg.wasm?v=test';
const localTable = 'https://app.example/tools/solver/rust-cross/tables/pt_cross.bin.gz?tv=1';
const remoteTable = 'https://static.example/tables/pt_cross.bin.gz?tv=1';

function harness(fetch: typeof globalThis.fetch, loadModule: () => Promise<unknown>) {
  const self = { location: { href: glueUrl }, postMessage: vi.fn(), onmessage: null as unknown };
  runInNewContext(source.replace('import(glueUrl)', 'loadModule(glueUrl)'), {
    self, fetch, loadModule, URL, Response, DecompressionStream, Uint8Array,
  });
  return { self, start: () => (self.onmessage as (event: unknown) => Promise<void>)({ data: {
    type: 'init', glueUrl, wasmUrl, tablesBase: 'https://static.example/tables', tableQuery: 'tv=1', need: 'cross',
  } }) };
}

it('starts the small-table and WASM downloads before glue resolves, without fetching XCross', async () => {
  let resolveModule!: (value: unknown) => void;
  const module = new Promise(resolve => { resolveModule = resolve; });
  const construct = vi.fn();
  const initialize = vi.fn();
  const fetch = vi.fn(async (url: string | URL | Request) => new Response(String(url) === localTable ? table : new Uint8Array()));
  const run = harness(fetch, () => module);
  const pending = run.start();
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([wasmUrl, localTable]);
  expect(run.self.postMessage).not.toHaveBeenCalled();
  resolveModule({ default: initialize, CrossSolverWasm: class { constructor(bytes: Uint8Array) { construct(bytes.length); } } });
  await pending;
  expect(construct).toHaveBeenCalledWith(139408);
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(run.self.postMessage).toHaveBeenCalledWith({ type: 'ready' });
});

it('falls back to the configured origin when an older host lacks the bundled table', async () => {
  const fetch = vi.fn(async (url: string | URL | Request) => String(url) === localTable
    ? new Response(null, { status: 404 }) : new Response(String(url) === remoteTable ? table : new Uint8Array()));
  const run = harness(fetch, async () => ({ default: vi.fn(), CrossSolverWasm: class {} }));
  await run.start();
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([wasmUrl, localTable, remoteTable]);
  expect(run.self.postMessage).toHaveBeenCalledWith({ type: 'ready' });
});
