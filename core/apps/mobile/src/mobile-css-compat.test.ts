import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const scrambleCss = readFileSync(
  new URL(import.meta.resolve('@cuberoot/timer-ui/scramble-strip.css')),
  'utf8',
);
const appCss = readFileSync(new URL(import.meta.resolve('@cuberoot/app-ui/app.css')), 'utf8');
const appearanceCss = readFileSync(new URL(import.meta.resolve('@cuberoot/app-ui/appearance.css')), 'utf8');

describe('installed mobile WebView build targets', () => {
  it('keeps OPPO WebView 103 syntax and iOS selection prefixes', () => {
    expect(viteConfig).toContain("target: 'chrome103'");
    expect(viteConfig).toContain("cssTarget: ['chrome103', 'safari15']");
  });

  it('keeps the loading spinner visible when color-mix is unsupported', () => {
    const spinner = scrambleCss.match(/\.scramble-status-spinner\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(spinner).toContain('border: 2px solid var(--border-default);');
    expect(spinner).not.toContain('color-mix(');
    expect(spinner).toContain('border-top-color: var(--accent);');
    expect(scrambleCss).toMatch(/@supports \(color: color-mix\([^)]+\)\)\s*\{[\s\S]*?\.scramble-status-spinner\s*\{[\s\S]*?border-color: color-mix\(/);
    expect(appCss).toContain("@import './appearance.css';");
    expect(appearanceCss).toMatch(/--border-default:\s*#[0-9a-f]{6};/);
  });
});
