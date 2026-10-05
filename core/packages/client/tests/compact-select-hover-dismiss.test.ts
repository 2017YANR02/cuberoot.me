// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CompactSelect } from '@cuberoot/timer-ui/compact-select';

let root: Root;
let host: HTMLDivElement;
const popup = () => document.querySelector('[role="listbox"]');
async function open(dismissOnMouseLeave?: boolean) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(CompactSelect, {
    label: 'Role', ariaLabel: 'Role', items: [{ value: 'admin', label: 'Admin' }],
    onChange: () => {}, openOnHover: true,
    ...(dismissOnMouseLeave === undefined ? {} : { dismissOnMouseLeave }),
  })));
  const trigger = host.querySelector('button')!;
  await act(async () => trigger.click());
  return trigger;
}
async function move(target: Element, x: number, y: number, pointerType = 'mouse') {
  const event = new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  await act(async () => { target.dispatchEvent(event); });
}
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
});

it('immediately dismisses outside without a click, while touch moves do not dismiss', async () => {
  await open();
  await move(document.body, 500, 500, 'touch');
  expect(popup()).not.toBeNull();
  await move(document.body, 500, 500);
  expect(popup()).toBeNull();
});

it.each([false, true])('keeps trigger, popup and crossing gap usable (above=%s)', async above => {
  const trigger = await open();
  const panel = popup()!;
  trigger.getBoundingClientRect = () => new DOMRect(100, 100, 32, 32);
  panel.getBoundingClientRect = () => new DOMRect(100, above ? 44 : 138, 160, 50);
  await move(trigger, 110, 110);
  await move(document.body, 110, above ? 97 : 135);
  expect(popup()).not.toBeNull();
  await move(panel.querySelector('button')!, 110, above ? 60 : 150);
  expect(popup()).not.toBeNull();
  await move(document.body, 95, above ? 97 : 135);
  expect(popup()).toBeNull();
});

it('allows hover-dismiss to be disabled explicitly', async () => {
  await open(false);
  await move(document.body, 500, 500);
  expect(popup()).not.toBeNull();
});

it('disables click and hover, closes an open menu, and allows selection after re-enabling', async () => {
  await open();
  expect(popup()).not.toBeNull();
  const selections: string[] = [];
  const render = (disabled: boolean) => act(async () => root.render(createElement(CompactSelect<string>, {
    id: 'account-region', label: 'Province', ariaLabel: 'Province',
    items: [{ value: 'SH', label: 'Shanghai' }], onChange: value => selections.push(value),
    openOnHover: true, disabled,
  })));
  await render(true);
  const trigger = host.querySelector('button')!;
  expect(trigger.id).toBe('account-region');
  expect(trigger.disabled).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(popup()).toBeNull();
  const hover = new MouseEvent('pointerover', { bubbles: true });
  Object.defineProperty(hover, 'pointerType', { value: 'mouse' });
  await act(async () => { trigger.click(); trigger.dispatchEvent(hover); });
  expect(popup()).toBeNull();
  expect(selections).toEqual([]);
  await render(false);
  await act(async () => trigger.click());
  expect(popup()).not.toBeNull();
  await act(async () => (popup()!.querySelector('button') as HTMLButtonElement).click());
  expect(selections).toEqual(['SH']);
  expect(popup()).toBeNull();
});
