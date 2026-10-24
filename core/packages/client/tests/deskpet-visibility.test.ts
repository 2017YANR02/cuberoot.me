// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
const route = vi.hoisted(() => ({ path: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.path }));
import { deskPetQuietPage, useDeskPetVisible } from '@/hooks/useDeskPetVisible';

it('hides timing and training routes without hiding catalogs or unrelated pages', () => {
  for (const path of ['/timer', '/zh/timer', '/en/timer/', '/cross_trainer', '/algTrainer', '/alg-trainers', '/alg/3x3/pll/run', '/alg/roux', '/alg/skewb-trainer', '/alg/sq1/train']) {
    expect(deskPetQuietPage(path), path).not.toBeNull();
  }
  for (const path of ['/', '/zh/alg/3x3/pll', '/alg/3x3/pll/select', '/timer-help', '/account']) {
    expect(deskPetQuietPage(path), path).toBeNull();
  }
});

it('shares explicit page overrides and preserves the global choice when navigating', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem('clawd-deskpet-visible', 'true');
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  function Control() {
    const [visible, setVisible] = useDeskPetVisible();
    return createElement('button', { onClick: () => setVisible(!visible) }, String(visible));
  }
  const render = async (path: string) => {
    route.path = path;
    await act(async () => root.render(createElement('div', null, createElement(Control), createElement(Control))));
    return [...host.querySelectorAll('button')].map(button => button.textContent);
  };
  try {
    expect(await render('/')).toEqual(['true', 'true']);
    expect(await render('/zh/timer')).toEqual(['false', 'false']);
    await act(async () => host.querySelector('button')!.click());
    expect(await render('/timer')).toEqual(['true', 'true']);
    expect(await render('/alg/3x3/pll/run')).toEqual(['false', 'false']);
    expect(await render('/')).toEqual(['true', 'true']);
    expect(localStorage.getItem('clawd-deskpet-visible')).toBe('true');
  } finally {
    await act(async () => root.unmount()); host.remove(); localStorage.clear();
  }
});
