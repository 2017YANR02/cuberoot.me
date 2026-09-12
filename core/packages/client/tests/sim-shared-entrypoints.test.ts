import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('sim compatibility entrypoints after shared renderer extraction', () => {
  // Knip excludes the sim tree, so a second compatibility hop could silently
  // keep pointing at an orphan file removed from components/puzzle-models.
  for (const [name, kind] of [
    ['history', 'default'], ['instanced', 'default'], ['panelFan', 'named'],
    ['setup_worker_client', 'named'], ['setup.worker', 'side-effect'],
  ] as const) {
    it(`routes ${name} directly through the existing renderer public export`, () => {
      const specifier = `@cuberoot/puzzle-render-core/engine/nxn/${name}`;
      const expected = kind === 'side-effect' ? `import '${specifier}';`
        : `${kind === 'default' ? `export { default } from '${specifier}';\n` : ''}export * from '${specifier}';`;
      const source = readFileSync(new URL(`../app/[lang]/sim/engine/nxn/${name}.ts`, import.meta.url), 'utf8');
      expect(source.trim()).toBe(expected);
      expect(existsSync(require.resolve(specifier))).toBe(true);
      expect(existsSync(new URL(`../components/puzzle-models/nxn/${name}.ts`, import.meta.url))).toBe(false);
    });
  }
});
