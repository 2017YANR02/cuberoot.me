import { describe, it, expect } from 'vitest';
import { pushSuffixAt, toggleFingerMark, playbackFingerAnnotations, spliceAlgHtml, sliceAlgHtml } from '@/lib/alg-finger-marks';
import { simFingerMarkSource } from '@/app/[lang]/sim/alg-manipulation';
import { algHtmlText } from '@/lib/alg_html';

const text = "(R2' u' R U') (R U R' u) (R2 f R' f')";
const html = "(R2' <s>u'</s> R U') (R U R' <u><s>u</s></u>) (R2 <em>f</em> R' f')";
describe('Gc finger annotations', () => {
  it('keeps the source moves and distinguishes finger from contact surface', () => {
    expect(algHtmlText(html)).toBe(text);
    const marks = playbackFingerAnnotations(text, html);
    expect(marks).toHaveLength(12);
    expect(marks[1]).toEqual({ finger: 'middle' });
    expect(marks[7]).toEqual({ finger: 'middle', contact: 'nail' });
    expect(marks[9]).toEqual({ finger: 'thumb' });
  });
  it('composes contact with a finger, replaces fingers, and removes only the toggled dimension', () => {
    let marked = toggleFingerMark("u'", "u'", 0, 2, 's');
    marked = toggleFingerMark("u'", marked, 0, 2, 'u');
    expect(playbackFingerAnnotations("u'", marked)).toEqual([{ finger: 'middle', contact: 'nail' }]);
    marked = toggleFingerMark("u'", marked, 0, 2, 'em');
    expect(playbackFingerAnnotations("u'", marked)).toEqual([{ finger: 'thumb', contact: 'nail' }]);
    marked = toggleFingerMark("u'", marked, 0, 2, 'u');
    expect(playbackFingerAnnotations("u'", marked)).toEqual([{ finger: 'thumb' }]);
  });
  it('uses full selected moves, ignores comments, and never marks subsequent whitespace', () => {
    const value = "R u' // U";
    expect(toggleFingerMark(value, value, 3, 4, 's')).toBe("R <s>u'</s> // U");
    expect(toggleFingerMark('u ', 'u ', 2, 2, 'u')).toBe('<u>u</u> ');
  });
  it('preserves marks in clipboard slices and repeated groups', () => {
    const copied = sliceAlgHtml(html, 5, 7);
    expect(copied).toBe("<s>u'</s>");
    expect(spliceAlgHtml('R U', 2, 3, copied)).toBe("R <s>u'</s>");
    expect(playbackFingerAnnotations('(u R)2', '(<s>u</s> R)2')).toEqual([
      { finger: 'middle' }, {}, { finger: 'middle' }, {},
    ]);
  });
  it('rejects contradictory, partial and unrecognized marks without discarding their source', () => {
    expect(() => playbackFingerAnnotations('u', '<s><em>u</em></s>')).toThrow('conflicting');
    expect(() => playbackFingerAnnotations("u'", "<s>u</s>'")).toThrow('partial');
    expect(() => playbackFingerAnnotations('u', '<u class="wavy">u</u>')).toThrow('unknown');
  });
});

describe('even-order simulator marks', () => {
  it('preserves source positions beside a grip, a push, a path and a comment', () => {
    const text = "↑｜↓ F′ Up// F\nR[R2:@C] (F)2";
    const source = simFingerMarkSource(text);
    const html = toggleFingerMark(text, text, 0, 6, 'em', source);
    expect(algHtmlText(html)).toBe(text);
    expect(playbackFingerAnnotations(text, html, source)).toEqual([{ finger: 'thumb' }, {}, {}, {}, {}]);
    expect(toggleFingerMark(text, html, text.indexOf('@'), text.indexOf(']'), 's', source)).toBe(html);
  });

  it('can remove an imported partial mark without applying it to the rest of the selection', () => {
    expect(toggleFingerMark("F' U", "<s>F</s>' U", 0, 4, 's', "F' U", true)).toBe("F' U");
  });
});

describe('push suffix keyboard target', () => {
  it('keeps the prime and targets an existing suffix when removing it', () => {
    expect(pushSuffixAt("↑U' D", 1, 3)).toEqual({ offset: 3, marked: false });
    expect(pushSuffixAt("U'p  D", 4, 4)).toEqual({ offset: 2, marked: true });
  });

  it('leaves comments, annotations, multi-move selections and unsupported turns untouched', () => {
    for (const [text, start, end] of [
      ['U // D', 5, 6], ['R[ D ]', 3, 4], ['(R U F)', 3, 4],
      ['U D', 0, 3], ['U2', 0, 2], ['R', 0, 1], ['', 0, 0],
    ] as const) expect(pushSuffixAt(text, start, end)).toBeNull();
  });
});
