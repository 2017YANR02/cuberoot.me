import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('homepage header touch targets', () => {
  it('keeps larger entry targets local to the homepage and mobile labels accessible', () => {
    const css = readFileSync(new URL('../app/landing.css', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../app/[lang]/LandingClient.tsx', import.meta.url), 'utf8');
    expect(css).toMatch(/\.landing-page \.landing-auth-icon\s*\{\s*width: 44px;\s*height: 44px;/);
    expect(css).toContain('flex-wrap: nowrap;');
    expect(css).toContain('.landing-page .landing-auth .theme-toggle-inline > svg');
    expect(css).toContain('.landing-page .landing-auth-btn.is-login > span');
    expect(source).toMatch(/className="landing-auth-btn is-login"[\s\S]*?aria-label=\{tr\(/);
  });
});
