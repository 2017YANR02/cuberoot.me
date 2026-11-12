import sanitizeHtml from 'sanitize-html';

/** Finger annotations have identical parsing rules in the browser, SSR and API. */
const options: sanitizeHtml.IOptions = {
  allowedTags: ['u', 's', 'em', 'strong', 'sub', 'sup'],
  allowedAttributes: { u: ['class'] },
  allowedClasses: { u: ['wavy'] },
  parseStyleAttributes: false,
};

export function sanitizeAlgHtml(html: string): string {
  return sanitizeHtml(html, options);
}

export function escapeAlgText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Apply the same textual normalization to inline markup, never accept a second move sequence. */
export function matchingAlgHtml(text: string, html: unknown, normalize: (text: string) => string = value => value): string {
  if (html == null || html === '') return '';
  if (typeof html !== 'string') throw new Error('Invalid solution annotations');
  const clean = sanitizeAlgHtml(normalize(sanitizeAlgHtml(html)));
  if (algHtmlText(clean) !== text) throw new Error('Solution annotations do not match the solution');
  return clean;
}

/** Source offsets and allowed inline tags, shared by editors and notation renderers. */
export function algHtmlRuns(html: string): Array<{ start: number; end: number; text: string; tags: string[] }> {
  const runs: Array<{ start: number; end: number; text: string; tags: string[] }> = [];
  const tags: string[] = [];
  let offset = 0;
  for (const part of sanitizeAlgHtml(html).split(/(<[^>]*>)/g)) {
    if (part.startsWith('</')) { tags.pop(); continue; }
    if (part.startsWith('<')) { tags.push(part); continue; }
    const text = algHtmlText(part);
    if (text) runs.push({ start: offset, end: offset + text.length, text, tags: [...tags] });
    offset += text.length;
  }
  return runs;
}

/** A local text replacement retains marks outside the changed selection. */
export function replaceAlgHtmlText(html: string, text: string): string {
  const before = algHtmlText(html);
  let start = 0;
  while (start < before.length && start < text.length && before[start] === text[start]) start++;
  let end = before.length, nextEnd = text.length;
  while (end > start && nextEnd > start && before[end - 1] === text[nextEnd - 1]) { end--; nextEnd--; }
  return editAlgHtmlText(html, [{ start, end, text: text.slice(start, nextEnd) }]);
}

/** Decode only after the HTML parser has removed all markup; return plain text. */
export function algHtmlText(html: string): string {
  const text = sanitizeHtml(html, { ...options, allowedTags: [], allowedAttributes: {} });
  const entities: Record<string, string> = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ' };
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, entity: string) => {
    if (entity.startsWith('#')) {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return entities[entity.toLowerCase()] ?? whole;
  });
}

/** Only algHtml fields are markup; preserve every algorithm and metadata value. */
export function sanitizeAlgHtmlFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAlgHtmlFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === 'algHtml' && typeof child === 'string' ? sanitizeAlgHtml(child) : sanitizeAlgHtmlFields(child),
  ]));
}

export interface AlgTextEdit { start: number; end: number; text: string }

/** Edit move text while retaining the markup of every untouched character.
 * New merged moves have no inferred finger assignment; source markup remains
 * available on the original entry. Never carry a deleted move's finger onto
 * a different move merely because it occupied the same string position.
 */
export function editAlgHtmlText(html: string, edits: readonly AlgTextEdit[]): string {
  if (!edits.length) return html;
  const chars: Array<{ text: string; tags: string[] }> = [];
  for (const run of algHtmlRuns(html)) {
    for (const text of run.text.split('')) chars.push({ text, tags: run.tags });
  }
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    chars.splice(edit.start, edit.end - edit.start, ...edit.text.split('').map(text => ({ text, tags: [] })));
  }
  let out = '';
  let active: string[] = [];
  const close = (tag: string) => `</${tag.match(/^<([a-z]+)/)![1]}>`;
  for (const char of chars) {
    let common = 0;
    while (common < active.length && active[common] === char.tags[common]) common++;
    out += active.slice(common).reverse().map(close).join('');
    out += char.tags.slice(common).join('');
    out += char.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    active = char.tags;
  }
  return out + active.reverse().map(close).join('');
}
