const CJK_REGEX = /[一-鿿]/;
// Find the final parenthesis group without retrying every opening parenthesis.
function trailingNameGroup(text: string): string | null {
  const end = text.trimEnd();
  if (!end.endsWith(')')) return null;
  const open = end.indexOf('(', end.lastIndexOf(')', end.length - 2) + 1);
  return open < 0 ? null : end.slice(open + 1, -1);
}

export interface DisplayCuberNameOptions {
  compactForeign?: boolean;
}

export function extractChineseName(text: string): string | null {
  const name = trailingNameGroup(text);
  return name && CJK_REGEX.test(name) ? name : null;
}

export function stripChineseParens(text: string): string {
  let out = '';
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('(', cursor);
    if (open < 0) break;
    const close = text.indexOf(')', open + 1);
    if (close < 0) break;
    out += text.slice(cursor, open).trimEnd() + ' ';
    cursor = close + 1;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
  }
  return (out + text.slice(cursor)).trim();
}

function compactForeignName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name;
  return `${parts[0]} ${Array.from(parts[parts.length - 1])[0]}.`;
}

/** Canonical WCA-name rendering shared by Web and installed apps. */
export function displayCuberName(
  rawName: string,
  isZh: boolean,
  options?: DisplayCuberNameOptions,
): string {
  if (!isZh) return stripChineseParens(rawName);
  const chineseName = extractChineseName(rawName);
  if (chineseName) return chineseName;
  const foreignName = stripChineseParens(rawName);
  return options?.compactForeign ? compactForeignName(foreignName) : foreignName;
}
