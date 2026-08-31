import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');

describe('Mobile startup shell', () => {
  it('shows the brand before and while the lazy application bundle loads', () => {
    expect(html).toContain('<main class="loading-screen"><strong>CubeRoot</strong></main>');
    expect(main).toContain('Suspense fallback={<main className="loading-screen"><strong>CubeRoot</strong></main>}');
  });
});
