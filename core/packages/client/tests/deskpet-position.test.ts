// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { readDeskPetAnchor } from '@/lib/deskpet-position';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

it.each([-96, 96])('does not accumulate a %s px visual viewport offset during repeated scroll events', (offset) => {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;right:-12px;bottom:24px;width:176px;height:176px';
  document.body.append(root);
  let viewportHeight = 744;
  vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => ({
    right: 390 + 12, bottom: viewportHeight - Number.parseFloat(root.style.bottom) + offset,
    width: 176, height: 176,
  }) as DOMRect);
  for (let event = 0; event < 100; event++) {
    viewportHeight = event % 2 ? 844 : 744;
    const anchor = readDeskPetAnchor(root, 390, viewportHeight);
    root.style.bottom = anchor.bottom + 'px';
    root.style.right = anchor.right + 'px';
  }
  expect(root.style.bottom).toBe('24px');
  expect(root.style.right).toBe('-12px');
});

it('reads new anchors after dragging and falls back to geometry only for auto anchors', () => {
  const root = document.createElement('div'); document.body.append(root);
  root.style.cssText = 'position:fixed;right:32px;bottom:180.5px';
  expect(readDeskPetAnchor(root, 390, 744)).toEqual({ right: 32, bottom: 180.5 });
  root.style.bottom = '64px';
  expect(readDeskPetAnchor(root, 390, 744).bottom).toBe(64);
  root.style.cssText = 'position:fixed;right:auto;bottom:auto';
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ right: 350, bottom: 700 } as DOMRect);
  expect(readDeskPetAnchor(root, 390, 744)).toEqual({ right: 40, bottom: 44 });
});
