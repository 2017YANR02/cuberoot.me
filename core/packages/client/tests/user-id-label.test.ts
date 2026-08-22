import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UserIdLabel } from '@/components/UserIdLabel';

describe('UserIdLabel', () => {
  it('renders the compact public ID beside authored content', () => {
    expect(renderToStaticMarkup(createElement(UserIdLabel, { userId: 66 }))).toContain('ID 66');
  });

  it('renders the full account label and hides invalid IDs', () => {
    expect(renderToStaticMarkup(createElement(UserIdLabel, { userId: 66, full: true }))).toContain('CubeRoot ID 66');
    expect(renderToStaticMarkup(createElement(UserIdLabel, { userId: null }))).toBe('');
    expect(renderToStaticMarkup(createElement(UserIdLabel, { userId: 0 }))).toBe('');
  });
});
