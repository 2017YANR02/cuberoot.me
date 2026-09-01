const CJK_REGEX = /[一-鿿]/;
const PAREN_ZH_REGEX = /\(([^)]*[一-鿿][^)]*)\)\s*$/;

export interface DisplayCuberNameOptions {
  compactForeign?: boolean;
}

export function extractChineseName(text: string): string | null {
  const match = PAREN_ZH_REGEX.exec(text);
  return match && CJK_REGEX.test(match[1]) ? match[1] : null;
}

export function stripChineseParens(text: string): string {
  return text.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
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
