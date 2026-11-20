import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { brotliDecompressSync } from 'node:zlib';
import { expect, it, vi } from 'vitest';
import { buildDouyinWcaScramble } from '../scripts/build-douyin-wca-scramble.mjs';

it('runs the shared scramble and preview providers in the native Worker package', async () => {
  const scratch = resolve(import.meta.dirname, '../../../../.tmp/scratch');
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, 'douyin-wca-test-'));
  try {
    await buildDouyinWcaScramble(root);
    const program = await readFile(join(root, 'workers/wca-scramble.js'), 'utf8');
    const nativeLoad = vi.fn(async (file, imports) => WebAssembly.instantiate(
      brotliDecompressSync(await readFile(join(root, file))), imports,
    ));
    const payload = { event: '333fm', entropy: randomBytes(16 * 1024).buffer };
    const loadWorker = (standardApi) => {
      const sandbox = {
        module: { exports: {} },
        globalThis: null,
        console,
        WebAssembly: standardApi,
        TTWebAssembly: { instantiate: nativeLoad },
      };
      runInNewContext(program, sandbox);
      return sandbox.module.exports;
    };
    const standardWorker = loadWorker(WebAssembly);
    const standard = await standardWorker.handleWcaScramblePayload(payload);
    // Twips normalizes adjacent turns, so the leading F may merge with the
    // first generated turn. The exact-output check below pairs both runtimes.
    expect(standard).toMatch(/^[RLUDFB](?:2|')?(?: [RLUDFB](?:2|')?)+$/);
    expect(nativeLoad).not.toHaveBeenCalled();
    await expect(loadWorker(undefined).handleWcaScramblePayload(payload)).resolves.toBe(standard);
    expect(nativeLoad).toHaveBeenCalledWith('workers/wca-scramble.wasm.br', expect.any(Object));

    const generate = event => standardWorker.handleWcaScramblePayload({ timerRequest: { event }, entropy: payload.entropy });
    await expect(generate('magic')).resolves.toMatch(/^(Forward|Backward)$/);
    await expect(generate('custom')).resolves.toBe('');
    for (const event of ['555bld', 'redi', 'mpyram', 'kilominx', 'superz']) {
      await expect(generate(event)).resolves.toMatch(/\S/);
    }
    for (const [puzzle, scramble] of [['fto', 'U L F'], ['redi_cube', 'U L F'], ['kilominx', 'R++ D-- U'], ['sphere', "R U R'"]]) {
      await expect(standardWorker.handleTimerPreviewPayload({ puzzle, scramble })).resolves.toMatch(/<svg\b/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);
