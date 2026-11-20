import { describe, it, expect } from 'vitest';
import { toggleFingerMark, playbackFingerAnnotations, spliceAlgHtml, sliceAlgHtml } from '@/lib/alg-finger-marks';
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
