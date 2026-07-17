/** First visible glyph of a name, uppercased — for avatar fallbacks. '?' when blank (63 = '?'). */
export function firstGlyph(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return String.fromCodePoint(trimmed.codePointAt(0) ?? 63).toUpperCase();
}
