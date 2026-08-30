import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  normalizeMiniProgramWebsitePath,
  resolveMiniProgramShareRouteKey,
} from '@/lib/miniprogram-share';

describe('Mini Program timeline share entry', () => {
  it('normalizes both Pattern B locales without inventing deep routes', () => {
    expect(normalizeMiniProgramWebsitePath('/')).toBe('/');
    expect(normalizeMiniProgramWebsitePath('/zh')).toBe('/');
    expect(normalizeMiniProgramWebsitePath('/zh/')).toBe('/');
    expect(normalizeMiniProgramWebsitePath('/zh/timer/')).toBe('/timer');
    expect(normalizeMiniProgramWebsitePath('/alg?event=333#case')).toBe('/alg');
  });

  it('derives only public canonical entries from the shared site directory', () => {
    expect(resolveMiniProgramShareRouteKey('/')).toBe('home');
    expect(resolveMiniProgramShareRouteKey('/zh')).toBe('home');
    expect(resolveMiniProgramShareRouteKey('/timer')).toBe('timer');
    expect(resolveMiniProgramShareRouteKey('/zh/timer/')).toBe('timer');
    expect(resolveMiniProgramShareRouteKey('/alg')).toBe('alg');
    expect(resolveMiniProgramShareRouteKey('/zh/alg')).toBe('alg');
    expect(resolveMiniProgramShareRouteKey('/zh/blog/')).toBe('blog');
    expect(resolveMiniProgramShareRouteKey('/tutorial')).toBeNull();
    expect(resolveMiniProgramShareRouteKey('/zh/account')).toBeNull();
    expect(resolveMiniProgramShareRouteKey('/alg/333')).toBeNull();
    expect(resolveMiniProgramShareRouteKey('/unknown')).toBeNull();
  });

  it('mounts one shared website affordance that enters the native share page', () => {
    const clientRoot = resolve(import.meta.dirname, '..');
    const component = readFileSync(
      resolve(clientRoot, 'components', 'MiniProgramTimelineShare.tsx'),
      'utf8',
    );
    const layout = readFileSync(resolve(clientRoot, 'app', '[lang]', 'layout.tsx'), 'utf8');
    const styles = readFileSync(
      resolve(clientRoot, 'components', 'miniprogram-timeline-share.css'),
      'utf8',
    );

    expect(layout).toContain('<MiniProgramTimelineShare />');
    expect(component).toContain('resolveVerifiedMiniProgramNavigationApi');
    expect(component).toContain('/pages/share/index?key=');
    expect(component).toContain('type="button"');
    expect(styles).toContain('right: max(16px');
    expect(styles).toContain('background: var(--primary)');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
