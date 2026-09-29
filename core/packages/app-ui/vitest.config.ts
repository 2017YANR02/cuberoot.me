import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Cover every lazy import from shared UI, including concurrent previews.
  resolve: { alias: {
    'cubing/twisty': fileURLToPath(new URL('./tests/fixtures/twisty.ts', import.meta.url)),
  } },
});
