import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MoreToggle from '@/components/MoreToggle';

describe('MoreToggle disclosure semantics', () => {
  it('keeps summary as a direct native details child without a nested button', () => {
    const html = renderToStaticMarkup(createElement('details', { open: true },
      createElement(MoreToggle, { as: 'summary', className: 'section-title' }, 'Advanced'),
      createElement('p', null, 'Content')));
    expect(html).toContain('<details open=""><summary class="more-toggle-summary section-title">');
    expect(html).not.toContain('<button');
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).not.toContain('aria-expanded'); // Native details owns the state.
  });
  it.each([false, true])('preserves controlled state and button attributes (%s)', expanded => {
    const html = renderToStaticMarkup(createElement(MoreToggle, {
      expanded, disabled: true, 'aria-controls': 'panel', className: 'section-title',
    }, 'Advanced'));
    expect(html).toContain(`aria-expanded="${expanded}"`);
    expect(html).toContain('aria-controls="panel"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('type="button"');
    expect(html.match(/<svg/g)).toHaveLength(1);
  });
  it('does not add default visible text to an icon-only labelled trigger', () => {
    const html = renderToStaticMarkup(createElement(MoreToggle, { expanded: false, 'aria-label': 'Advanced' }));
    expect(html).toContain('aria-label="Advanced"');
    expect(html).not.toContain('More</');
  });
});
