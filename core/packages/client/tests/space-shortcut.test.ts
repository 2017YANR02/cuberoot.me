// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { isSpaceShortcut } from '@/hooks/useSpaceShortcut';

function keydown(target: Element, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', init);
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('space shortcut', () => {
  it('accepts one plain Space press outside controls only', () => {
    expect(isSpaceShortcut(keydown(document.body, { code: 'Space' }))).toBe(true);
    expect(isSpaceShortcut(keydown(document.body, { code: 'Space', repeat: true }))).toBe(false);
    expect(isSpaceShortcut(keydown(document.body, { code: 'Space', ctrlKey: true }))).toBe(false);
    expect(isSpaceShortcut(keydown(document.createElement('textarea'), { code: 'Space' }))).toBe(false);
    expect(isSpaceShortcut(keydown(document.createElement('button'), { code: 'Space' }))).toBe(false);
  });
});
