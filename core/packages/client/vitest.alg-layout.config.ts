import config from './vitest.config';

// Reuse the client aliases and transforms, but run only the Chromium layout suite.
export default {
  ...config,
  test: { ...config.test, include: ['tests/alg-formula-layout.browser.test.ts'], exclude: [] },
};
