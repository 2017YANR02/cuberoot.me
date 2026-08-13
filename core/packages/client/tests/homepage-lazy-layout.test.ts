import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CLIENT = join(import.meta.dirname, '..');

const widgets = [
  ['RecentScrambles.tsx', 'recent_scrambles.css', 'recent-scrambles', 320],
  ['TodayRecon.tsx', 'today_recon.css', 'today-recon', 360],
  ['OngoingComps.tsx', 'ongoing_comps.css', 'ongoing-comps', 240],
] as const;

describe('homepage lazy widget geometry', () => {
  it.each(widgets)('%s reserves height only while loading', (component, stylesheet, className, height) => {
    const source = readFileSync(join(CLIENT, 'components', component), 'utf8');
    const css = readFileSync(join(CLIENT, 'components', stylesheet), 'utf8');
    const baseRule = css.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    const loadingRule = css.match(new RegExp(`\\.${className}--loading\\s*\\{([^}]*)\\}`))?.[1] ?? '';

    expect(source).toContain(`${className} ${className}--loading`);
    expect(baseRule).not.toContain('min-height');
    expect(loadingRule).toContain(`min-height: ${height}px`);
  });
});
