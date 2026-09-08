import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

describe('results initial loading', () => {
  it.each([
    'components/persons/sections/PersonTabs.tsx',
    'app/[lang]/wca/comp/[slug]/CompDetailPage.tsx',
  ])('%s keeps reconstruction and calendar code out of its static import graph', async (entryPoint) => {
    const result = await build({
      absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
      entryPoints: [entryPoint],
      bundle: true,
      write: false,
      outdir: '../../../.tmp/png/person-results-imports',
      metafile: true,
      format: 'esm',
      platform: 'browser',
      packages: 'external',
      logLevel: 'silent',
      plugins: [{
        name: 'initial-imports-only',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) => (
            args.kind === 'dynamic-import' ? { path: args.path, external: true } : undefined
          ));
        },
      }],
    });
    const inputs = Object.keys(result.metafile.inputs).map((path) => path.replaceAll('\\', '/'));
    if (entryPoint.includes('PersonTabs')) {
      expect(inputs).toContain('components/persons/sections/results/ResultsTab.tsx');
      expect(inputs).toContain('components/persons/sections/results/ByEventView.tsx');
    }
    expect(inputs.filter((path) => /ScheduleCalendar|ScheduleView|CompScramblesTab/.test(path))).toEqual([]);
    expect(inputs).toContain('components/persons/sections/results/AttemptPopover.tsx');
    expect(inputs.filter((path) => /components\/(?:recon\/|SolutionView|puzzle-models\/)|\/sim\/engine\//.test(path))).toEqual([]);
    const eagerGraphics = Object.values(result.metafile.inputs).flatMap((input) => input.imports)
      .filter((entry) => entry.kind !== 'dynamic-import' && /^(?:three|cubing|@fullcalendar)(?:\/|$)/.test(entry.path));
    expect(eagerGraphics).toEqual([]);
  });
});
