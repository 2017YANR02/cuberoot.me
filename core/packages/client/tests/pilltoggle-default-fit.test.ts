// Preserve the public boolean control while labelled two-choice pills are retired.
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BoolToggle from '@/components/BoolToggle';
import SharedBoolToggle from '@cuberoot/timer-ui/BoolToggle';

describe.each([['Web', BoolToggle], ['Shared', SharedBoolToggle]] as const)('%s boolean switches', (_name, Component) => {
  it.each([false, true])('preserves the label, switch semantics and disabled state (value=%s)', value => {
    const html = renderToStaticMarkup(createElement(Component, {
      value, onChange: () => {}, label: 'Show history', disabled: true,
    }));
    expect(html).toContain('class="bool-toggle-label"');
    expect(html.indexOf('class="bool-toggle-label"')).toBeLessThan(html.indexOf('role="switch"'));
    expect(html).toContain(`aria-checked="${value}"`);
    expect(html).toContain('aria-label="Show history"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('<select');
  });
});
