import { describe, expect, it } from 'vitest';
import { SCRAMBLE_222_TYPE_CATALOG, TIMER_333_SCRAMBLE_TYPES } from '@cuberoot/shared/timer';
import {
  TRAINING_DIRECTORY, resolveTrainingTarget, trainingEventForTarget,
} from '@/lib/timer-training-catalog';
import {
  timerPracticeContents, selectedTimerPracticeContent,
} from '@/lib/timer-practice-navigation';

describe('timer practice content navigation', () => {
  it('joins random timing, selected cases and recognition under each formula content once', () => {
    const entries = timerPracticeContents('333');
    expect(entries[0]).toMatchObject({ id: 'solve', timer: { event: '333' } });
    expect(entries.filter(entry => entry.set === 'oll')).toHaveLength(1);
    const oll = entries.find(entry => entry.set === 'oll');
    expect(oll).toMatchObject({
      id: '/alg/3x3/oll/select', timer: { event: 'oll' },
      selectPath: '/alg/3x3/oll/select', runPath: '/alg/3x3/oll/run', recognizePath: '/recognize/oll',
    });
    expect(entries.some(entry => entry.path === '/recognize/oll')).toBe(false);
    expect(entries.find(entry => entry.set === '1lll')).toMatchObject({
      timer: { event: 'll' }, recognizePath: '/recognize/1lll',
    });
    for (const type of TIMER_333_SCRAMBLE_TYPES) {
      expect(entries.filter(entry => entry.timer?.event === type.event), type.event).toHaveLength(1);
    }
    for (const path of ['/alg/333/oll/select', '/alg/3x3/oll/run', '/alg/333/oll/one', '/recognize/oll', '/recognize/oll/guide']) {
      expect(selectedTimerPracticeContent(entries, '333', 'full', resolveTrainingTarget(path)), path).toBe(oll);
    }
  });

  it('keeps every 2x2 subtype and the existing EG event identities while pairing TCLL names', () => {
    const entries = timerPracticeContents('222');
    expect(entries.find(entry => entry.set === 'tcll-plus')).toMatchObject({ timer: { event: '222', type222: 'tcllp' } });
    expect(entries.find(entry => entry.set === 'tcll-minus')).toMatchObject({ timer: { event: '222', type222: 'tclln' } });
    for (const type of SCRAMBLE_222_TYPE_CATALOG) {
      const selected = selectedTimerPracticeContent(entries, '222', type.id, null);
      const separateEvent = type.id === 'eg1' || type.id === 'eg2';
      expect(selected?.timer, type.id).toEqual({ event: separateEvent ? type.id : '222', type222: separateEvent ? 'full' : type.id });
      if (separateEvent) {
        expect(selectedTimerPracticeContent(entries, type.id, 'tcllp', null)).toBe(selected);
        expect(timerPracticeContents(type.id)[0].timer).toEqual({ event: '222', type222: 'full' });
      }
    }
  });

  it.each(['333oh', '333fm', '333ni', '333bld', '333mbld', '444bld', 'sq1', 'mega', 'clock'])('preserves %s as its full-solve event', event => {
    const entries = timerPracticeContents(event);
    expect(entries[0].timer).toEqual({ event });
    expect(selectedTimerPracticeContent(entries, event, 'tcllp', null)).toBe(entries[0]);
  });

  it('keeps the complete existing directory reachable without duplicate IDs or formula contents', () => {
    for (const group of TRAINING_DIRECTORY) for (const item of group.items) {
      const target = resolveTrainingTarget(item.path)!;
      const entries = timerPracticeContents(trainingEventForTarget(target) ?? '333');
      expect(entries.some(entry => [entry.path, entry.selectPath, entry.runPath, entry.recognizePath].includes(item.path)), item.path).toBe(true);
      const selected = selectedTimerPracticeContent(entries, '333', 'full', target);
      expect(selected, item.path).toBeDefined();
      if (selected?.path) {
        expect(selected.id, item.path).toBe(item.path);
        expect(selected.group, item.path).toEqual({ id: group.id, title: group.title });
      }
      expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length);
      const formulas = entries.filter(entry => entry.puzzle && entry.set).map(entry => `${entry.puzzle}/${entry.set}`);
      expect(new Set(formulas).size).toBe(formulas.length);
    }
  });

  it('matches virtual LSLL and SQ1 supporting deep links without adding duplicate tools', () => {
    const entries = timerPracticeContents('333');
    const lsll = entries.find(entry => entry.set === 'lsll');
    expect(lsll).toMatchObject({ id: '/alg/3x3/lsll/run', selectPath: '/alg/lsll', runPath: '/alg/3x3/lsll/run' });
    for (const path of ['/alg/lsll', '/alg/lsll/ap', '/alg/lsll/case?k=123', '/alg/lsll/route?round=2', '/alg/3x3/lsll/run']) {
      expect(selectedTimerPracticeContent(entries, '333', null, resolveTrainingTarget(path)), path).toBe(lsll);
    }
    const sq1 = timerPracticeContents('sq1');
    expect(selectedTimerPracticeContent(sq1, 'sq1', null, resolveTrainingTarget('/sq1/cs/name'))?.path).toBe('/sq1/cs/name/train');
    expect(selectedTimerPracticeContent(entries, '333', null, resolveTrainingTarget('/alg/333/cross'))?.path).toBe('/alg/3x3/cross');
  });
});
