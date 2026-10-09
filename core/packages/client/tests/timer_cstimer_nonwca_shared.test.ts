import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

import {
  CSTIMER_NONWCA_TIMER_EVENTS,
  CSTIMER_NONWCA_TIMER_KEYS,
} from '@cuberoot/puzzle-solvers/cstimer-nonwca-events';
import {
  NON_WCA_EVENT_IDS,
  cstimerKeyForEvent,
  isNonWcaEvent,
} from '@/app/[lang]/timer/_lib/scramble/nonwca';

const workerSource = readFileSync(new URL(
  '../app/[lang]/timer/_lib/scramble/cstimer-nonwca-shared.worker.ts',
  import.meta.url,
), 'utf8');
const adapterSource = readFileSync(new URL(
  '../app/[lang]/timer/_lib/scramble/nonwca.ts',
  import.meta.url,
), 'utf8');

describe('Web shared Kilominx/Master Pyraminx provider adapter', () => {
  it('does not load the csTimer worker message handler into the browser main thread', async () => {
    const result = await build({
      entryPoints: [fileURLToPath(new URL(
        '../app/[lang]/timer/_lib/scramble/nonwca.ts', import.meta.url,
      ))],
      bundle: true,
      metafile: true,
      platform: 'browser',
      format: 'esm',
      write: false,
    });
    const { inputs, outputs } = result.metafile!;
    const entry = Object.values(outputs).find(output => output.entryPoint)!.entryPoint!;
    const loaded = new Set<string>();
    function visit(path: string) {
      if (loaded.has(path)) return;
      loaded.add(path);
      for (const dependency of inputs[path]?.imports ?? []) {
        // The shared runtime also offers a lazy provider for Node/worker
        // callers. Only eager imports run when a browser loads this adapter.
        if (!dependency.external && dependency.kind !== 'dynamic-import') visit(dependency.path);
      }
    }
    visit(entry);
    expect([...loaded]).toContainEqual(expect.stringMatching(/cstimer-nonwca-events\.ts$/));
    expect([...loaded].filter(input => input.includes('cstimer_module'))).toEqual([]);
  });

  it('keeps exact Timer and csTimer identities', () => {
    expect(CSTIMER_NONWCA_TIMER_EVENTS).toEqual(['kilominx', 'mpyram']);
    expect(CSTIMER_NONWCA_TIMER_KEYS).toEqual({
      kilominx: 'klmso',
      mpyram: 'mpyrso',
    });
    for (const event of CSTIMER_NONWCA_TIMER_EVENTS) {
      expect(isNonWcaEvent(event)).toBe(true);
      expect(NON_WCA_EVENT_IDS).toContain(event);
      expect(cstimerKeyForEvent(event)).toBe(CSTIMER_NONWCA_TIMER_KEYS[event]);
    }
  });

  it('keeps the Web worker a thin adapter over the package provider', () => {
    expect(workerSource).toContain("from '@cuberoot/puzzle-solvers/cstimer-nonwca'");
    expect(workerSource).toContain('generateCstimerNonWcaTimerScramble(event)');
    expect(workerSource).not.toContain("getScramble('klmso'");
    expect(workerSource).not.toContain("getScramble('mpyrso'");
    expect(adapterSource).not.toContain("key: 'klmso'");
    expect(adapterSource).not.toContain("key: 'mpyrso'");
  });
});
