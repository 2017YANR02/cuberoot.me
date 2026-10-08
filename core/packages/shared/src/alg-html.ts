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
