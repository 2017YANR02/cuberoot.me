import { algHtmlRuns, algHtmlText, escapeAlgText, replaceAlgHtmlText } from './alg_html';
import { findTokenPositions, reconPlaybackTokenPositions } from './recon-alg-utils';

export type FingerMark = 's' | 'em' | 'u';
export interface FingerAnnotation {
  finger?: 'middle' | 'thumb';
  contact?: 'nail';
}

/** Formatting and mechanics are separate: underline specifies a contact surface, not push. */
export function fingerAnnotation(tags: readonly string[]): FingerAnnotation {
  const middle = tags.includes('<s>'), thumb = tags.includes('<em>');
  if (middle && thumb) throw new Error('conflicting-fingers');
  if (tags.some(tag => tag.includes('wavy'))) throw new Error('unknown-finger-mark');
  return { ...(middle ? { finger: 'middle' as const } : thumb ? { finger: 'thumb' as const } : {}),
    ...(tags.includes('<u>') ? { contact: 'nail' as const } : {}) };
}

export function hasFingerMarks(html: string): boolean {
  return algHtmlRuns(html).some(run => run.tags.some(tag => /^<(s|em|u)[ >]/.test(tag)));
}

export function selectedFingerMark(html: string, start: number, end: number, mark: FingerMark): boolean {
  const runs = algHtmlRuns(html).filter(run => run.start < end && run.end > start && run.text.trim());
  return runs.length > 0 && runs.every(run => run.tags.includes(`<${mark}>`));
}

function characters(html: string) {
  return algHtmlRuns(html).flatMap(run => run.text.split('').map(text => ({ text, tags: [...run.tags] })));
}

function serialize(chars: { text: string; tags: string[] }[]): string {
  let html = '', active: string[] = [];
  const close = (tag: string) => `</${tag.match(/^<([a-z]+)/)![1]}>`;
  for (const char of chars) {
    let common = 0;
    while (common < active.length && active[common] === char.tags[common]) common++;
    html += active.slice(common).reverse().map(close).join('') + char.tags.slice(common).join('') + escapeAlgText(char.text);
    active = char.tags;
  }
  return html + active.reverse().map(close).join('');
}

/** Full selected moves, or the move immediately before the caret. Never mark whitespace/new input. */
export function toggleFingerMark(text: string, html: string, start: number, end: number, mark: FingerMark): string {
  const chars = characters(replaceAlgHtmlText(html || escapeAlgText(text), text));
  const moves = findTokenPositions(text);
  const targets = start === end ? moves.filter(move => move.start < start).slice(-1)
    : moves.filter(move => move.start < end && move.end > start);
  const tag = `<${mark}>`;
  const remove = targets.length > 0 && targets.every(move => chars.slice(move.start, move.end).every(char => char.tags.includes(tag)));
  for (const move of targets) for (let i = move.start; i < move.end; i++) {
    const char = chars[i];
    char.tags = char.tags.filter(existing => existing !== tag && (remove ||
      !(mark === 's' && existing === '<em>') && !(mark === 'em' && existing === '<s>')));
    if (!remove) char.tags.push(tag);
  }
  return serialize(chars);
}

export function sliceAlgHtml(html: string, start: number, end: number): string {
  return serialize(characters(html).slice(start, end));
}

export function spliceAlgHtml(html: string, start: number, end: number, insertedHtml: string): string {
  const chars = characters(html);
  chars.splice(start, end - start, ...characters(insertedHtml));
  return serialize(chars);
}

/** Source-to-playback mapping is verified; unsupported group inversions never silently lose marks. */
export function playbackFingerAnnotations(text: string, html: string): FingerAnnotation[] {
  if (algHtmlText(html) !== text) throw new Error('mismatched-finger-text');
  const positions = reconPlaybackTokenPositions(text);
  if (!positions.length && hasFingerMarks(html)) throw new Error('unsupported-finger-sequence');
  const chars = characters(html);
  return positions.map(move => {
    const annotations = chars.slice(move.start, move.end).map(char => fingerAnnotation(char.tags));
    const first = annotations[0] ?? {};
    if (annotations.some(annotation => JSON.stringify(annotation) !== JSON.stringify(first))) throw new Error('partial-finger-mark');
    return first;
  });
}
