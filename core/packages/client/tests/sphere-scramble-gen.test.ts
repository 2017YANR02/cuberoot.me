import { describe, expect, it } from 'vitest';
import { scrambleEventPickerGroups } from '@/app/[lang]/scramble/gen/_event-picker';
import { CSTIMER_EVENT_IDS } from '@/lib/cstimer-scramble';
import { NATIVE_SCRAMBLE_EVENT_IDS } from '@/lib/native-scramble';
import {
  SHAPE_MOD_APPEND, SHAPE_MOD_EVENT_IDS, isShapeModEvent, shapeModSourceEvent,
} from '@/lib/shape-mod-scramble';
import { eventDisplayName } from '@/lib/wca-events';

describe('Sphere Cube scramble generator registration', () => {
  it('shares the existing 333 provider and appears under its own identity in every generator picker', () => {
    expect(isShapeModEvent('sphere')).toBe(true);
    expect(shapeModSourceEvent('sphere')).toBe('333');
    expect(CSTIMER_EVENT_IDS.has('sphere')).toBe(false);
    expect(NATIVE_SCRAMBLE_EVENT_IDS.has('sphere')).toBe(false);
    expect(eventDisplayName('sphere', true)).toBe('球形');
    expect(eventDisplayName('sphere', false)).toBe('Sphere Cube');
    const groups = scrambleEventPickerGroups([...SHAPE_MOD_EVENT_IDS], SHAPE_MOD_APPEND, true);
    expect(groups.find(({ id }) => id === 'other')?.items.find(({ id }) => id === 'sphere')).toEqual({
      id: 'sphere', label: '球形', iconClass: undefined, textLabel: 'Sphere',
    });
  });
});
