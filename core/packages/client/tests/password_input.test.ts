import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PasswordInput } from '@/components/PasswordInput';

describe('PasswordInput', () => {
  it('renders its controlled visibility state', () => {
    const render = (show: boolean) => renderToStaticMarkup(createElement(PasswordInput, {
      value: 'secret',
      onChange: () => undefined,
      show,
      onShowChange: () => undefined,
    }));

    expect(render(false)).toContain('type="password"');
    expect(render(false)).toContain('lucide-eye-off');
    expect(render(true)).toContain('type="text"');
    expect(render(true)).toContain('lucide-eye"');
  });
});
