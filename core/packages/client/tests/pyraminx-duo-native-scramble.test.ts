import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generatePyraminxDuoScramble } from '@cuberoot/puzzle-solvers/pyraminx-duo';
import { scrambleEventPickerGroups } from '@/app/[lang]/scramble/gen/_event-picker';
import { EventIcon, eventIconClass } from '@/components/EventIcon/EventIcon';
import { CSTIMER_EVENT_IDS } from '@/lib/cstimer-scramble';
import {
  NATIVE_SCRAMBLE_APPEND,
  NATIVE_SCRAMBLE_EVENT_IDS,
  isNativeScrambleEvent,
  nativeScramble,
} from '@/lib/native-scramble';
import { eventDisplayName, isWcaEvent } from '@/lib/wca-events';

describe('native Pyraminx Duo scramble integration', () => {
  it('keeps the native generator identical to the canonical generator for the same random input', async () => {
    expect(await nativeScramble('pyraminx_duo', () => 0.375))
      .toBe(generatePyraminxDuoScramble(() => 0.375));
    await expect(nativeScramble('unknown')).rejects.toThrow('Unsupported native scramble event');
  });

  it('presents Duo as a named non-WCA event without fabricating an upstream csTimer key', () => {
    expect(isNativeScrambleEvent('pyraminx_duo')).toBe(true);
    expect(CSTIMER_EVENT_IDS.has('pyraminx_duo')).toBe(false);
    expect(isWcaEvent('pyraminx_duo')).toBe(false);
    expect(eventDisplayName('pyraminx_duo', true)).toBe('二重奏');
    expect(eventDisplayName('pyraminx_duo', false)).toBe('Pyraminx Duo');

    const groups = scrambleEventPickerGroups(['333', ...NATIVE_SCRAMBLE_EVENT_IDS], NATIVE_SCRAMBLE_APPEND, true);
    expect(groups.find(({ id }) => id === 'wca')?.items.map(({ id }) => id)).toEqual(['333', 'magic', 'mmagic']);
    expect(groups.find(({ id }) => id === 'other')?.items.find(({ id }) => id === 'pyraminx_duo')).toEqual({
      id: 'pyraminx_duo',
      label: '二重奏',
      iconClass: undefined,
      textLabel: 'Duo',
    });
  });

  it('renders a real Duo glyph in result headers while keeping the picker text badge', () => {
    expect(eventIconClass('pyraminx_duo')).toBe('unofficial-pyraminx_duo');
    const markup = renderToStaticMarkup(createElement(EventIcon, { event: 'pyraminx_duo' }));
    expect(markup).toContain('<svg');
    expect(markup).toContain('fill="currentColor"');
    expect(markup.match(/<path\b/g)).toHaveLength(4);
    expect(NATIVE_SCRAMBLE_APPEND.find(({ id }) => id === 'pyraminx_duo')).toEqual({
      id: 'pyraminx_duo', iconClass: '', textLabel: 'Duo',
    });
  });
});
