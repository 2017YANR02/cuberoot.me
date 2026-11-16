import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { buildStages, profileBuild } from '../scripts/profile-build.mts';

describe('build profiling', () => {
  it('expands the real dependency plan without changing the remaining build order', () => {
    const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const commands = buildStages(scripts).map(parts => parts.join(' '));
    expect(commands).toEqual([
      ...scripts['build:deps'].split(' && '),
      ...scripts.build.split(' && ').slice(1),
    ]);
    expect(() => buildStages({ build: 'node "path with spaces.mts"' })).toThrow('Unsupported build command');
    expect(() => buildStages({ build: 'pnpm run build:deps', 'build:deps': 'pnpm run build:deps' })).toThrow();
  });

  it('passes Turbo dependency selectors intact while rejecting shell operators', () => {
    expect(buildStages({ build: 'turbo run build:ci --filter=@cuberoot/client^...' }))
      .toEqual([['turbo', 'run', 'build:ci', '--filter=@cuberoot/client^...']]);
    for (const build of ['node build.mjs | cat', 'node build.mjs; echo done', 'node $(echo build.mjs)', 'node build.mjs > output']) {
      expect(() => buildStages({ build })).toThrow('Unsupported build command');
    }
  });

  it.each([
    { status: 7, signal: null },
    { status: null, signal: 'SIGTERM' as const },
    { status: null, signal: null, error: new Error('ENOENT') },
  ])('stops on failure and reports completed work: %j', failure => {
    const run = vi.fn().mockReturnValueOnce({ status: 0, signal: null }).mockReturnValueOnce(failure);
    const report = vi.fn();
    const result = profileBuild([['first'], ['second'], ['must-not-run']], run, report);
    expect(run.mock.calls).toEqual([['first', []], ['second', []]]);
    expect(result).toEqual({ status: failure.status ?? 1, signal: failure.signal });
    expect(report.mock.calls[0][0]).toContain('`first`');
    expect(report.mock.calls[0][0]).toContain('`second`');
    expect(report.mock.calls[0][0]).not.toContain('must-not-run');
  });
});
