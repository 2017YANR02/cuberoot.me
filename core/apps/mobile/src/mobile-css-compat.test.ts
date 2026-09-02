import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

describe('installed Android WebView build target', () => {
  it('keeps JS and CSS compatible with the tested OPPO WebView 103', () => {
    expect(viteConfig).toContain("target: 'chrome103'");
    expect(viteConfig).toContain("cssTarget: 'chrome103'");
  });
});
