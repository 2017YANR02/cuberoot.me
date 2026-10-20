import { describe, expect, it } from 'vitest';
import { canonicalTimerPracticeSearch as canonical, decodeTimerPracticeSearch as decode, encodeTimerPracticeSearch as encode } from '@/lib/timer-practice-url';

describe('public practice URL contract', () => {
  it('unifies homepage, library and timer entries without conflating selection with practice', () => {
    expect(canonical('training=/alg/3x3/zbll/run').toString()).toBe('content=zbll&source=cases');
    expect(canonical('training=/alg/333/zbll/select').toString()).toBe('content=zbll&source=cases&view=select');
    expect(canonical('event=zbll&players=1&training=/alg/3x3/zbll/select&train.mode=recap&train.timing=0').toString())
      .toBe('content=zbll&source=cases&view=select');
  });

  it('separates random states from random selection and recall', () => {
    expect(canonical('event=zbll').toString()).toBe('content=zbll');
    expect(decode('content=zbll').get('event')).toBe('zbll');
    expect(decode('content=zbll').has('training')).toBe(false);
    const search = canonical('training=/alg/3x3/zbll/run&train.mode=memo&train.draw=train');
    expect(search.toString()).toBe('content=zbll&source=cases&method=recall&draw=random');
    expect(decode(search).get('train.mode')).toBe('memo');
    expect(decode(search).get('train.draw')).toBe('train');
    expect(decode('content=zbll&source=cases').get('train.mode')).toBe('recap');
  });

  it.each([
    ['training=/alg/3x3/lsll/run', 'content=lsll&source=cases', null],
    ['training=/alg/3x3/lsll/run&train.scope=zbls', 'content=lsll&source=cases&round=1', 'zbls'],
    ['training=/alg/3x3/lsll/run&train.scope=zbls-r7', 'content=lsll&source=cases&round=7', 'zbls-r7'],
    ['training=/alg/3x3/lsll/run&train.scope=ap-eo2', 'content=lsll&source=cases&group=ap&flippedEdges=2', 'ap-eo2'],
  ])('preserves LSLL session scope for %s', (old, expected, scope) => {
    expect(canonical(old).toString()).toBe(expected);
    expect(decode(expected).get('train.scope')).toBe(scope);
  });

  it('roundtrips the custom LSLL selector and recognition guide', () => {
    expect(canonical('training=/alg/lsll/ap&train.eo=2').toString())
      .toBe('content=lsll&source=cases&view=select&group=ap&flippedEdges=2');
    expect(decode('content=lsll&source=cases&view=select&group=ap&flippedEdges=2').get('training')).toBe('/alg/lsll/ap');
    expect(canonical('training=/recognize/oll/guide').toString())
      .toBe('content=oll&source=cases&method=recognition&view=guide');
  });

  it('retains real projects and existing generator identities', () => {
    expect(canonical('event=333oh&training=/alg/3x3/zbll/run').get('event')).toBe('333oh');
    expect(canonical('event=444&training=/alg/3x3/zbll/run').has('event')).toBe(false);
    expect(canonical('training=/alg/2x2/eg1/run').toString()).toBe('event=222&content=eg1&source=cases');
    expect(decode('event=222&content=eg1').get('event')).toBe('eg1');
    expect(canonical('event=ll').toString()).toBe('content=1lll');
    expect(decode('content=1lll').get('event')).toBe('ll');
    expect(decode('event=222&content=tcll-plus').get('scramble222')).toBe('tcllp');
    expect(encode('event=222&scramble222=tcllp').toString()).toBe('event=222&content=tcll-plus');
    expect(decode('event=222').get('scramble222')).toBe('full');
    expect(canonical('training=/alg/3x3/zbll/run&train.scope=U1').get('group')).toBe('ur');
  });

  it('keeps room/share namespaces, assignment attribution and repeated case keys separate', () => {
    const old = 'training=/alg/3x3/pll/run&room=timer&share=solve&players=2&train.room=trainer&train.share=practice&train.case=A&train.case=B&trainingOrg=school&trainingAssignment=task';
    const result = canonical(old);
    expect(result.get('room')).toBe('timer');
    expect(result.get('trainingRoom')).toBe('trainer');
    expect(result.get('share')).toBe('solve');
    expect(result.get('trainingShare')).toBe('practice');
    expect(result.getAll('case')).toEqual(['A', 'B']);
    expect(result.get('trainingAssignment')).toBe('task');
    expect(decode(result).get('train.room')).toBe('trainer');
    expect(decode(result).get('players')).toBe('2');
    expect(canonical(result).toString()).toBe(result.toString());
  });

  it.each([
    'content=zbll&source=cases&view=select&group=ur',
    'content=lsll&source=cases&selection=stored',
    'content=mix&source=cases&sets=pll,zbll',
    'content=zbll&source=cases&method=recall&draw=random',
    'event=222&content=eg1',
    'event=222&content=tcll-plus',
    'event=222&content=ls',
    'event=333oh',
    'players=2&event=333,222',
    'training=/alg/roux&train.mode=fb',
  ])('does not drift on repeated navigation: %s', search => {
    const first = canonical(search);
    expect(canonical(first).toString()).toBe(first.toString());
    expect(encode(decode(first)).toString()).toBe(first.toString());
  });

  it('keeps invalid random content out of the ordinary timer', () => {
    expect(decode('content=does-not-exist').get('training')).toBe('/unsupported-practice');
  });
});
