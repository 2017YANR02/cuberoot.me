// @vitest-environment jsdom
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
vi.mock('@/components/CubeVirtualKeyboard', () => ({ default: () => createElement('div', { 'data-keyboard': true }) }));
import CubeKeyboardSection from '@/components/CubeKeyboardSection';

it.each([false, true])('preserves keyboard activation and collapse with iconOnly=%s', async iconOnly => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const toolbar = document.createElement('div');
  document.body.append(host, toolbar);
  const root = createRoot(host);
  const onActivate = vi.fn();
  try {
    await act(async () => root.render(createElement(CubeKeyboardSection, {
      target: createRef<HTMLDivElement>(), toggleContainer: toolbar, iconOnly, onActivate,
    })));
    const button = toolbar.querySelector('button')!;
    expect(button.querySelectorAll('svg')).toHaveLength(iconOnly ? 1 : 2);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('[data-keyboard]')).toBeNull();
    await act(async () => button.click());
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Hide keyboard');
    expect(host.querySelector('[data-keyboard]')).not.toBeNull();
    await act(async () => button.click());
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('[data-keyboard]')).toBeNull();
    expect(onActivate).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    host.remove(); toolbar.remove(); vi.unstubAllGlobals();
  }
});
