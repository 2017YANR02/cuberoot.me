const CJK_RE = /[㐀-鿿豈-﫿]/;

export function stripWcaPrefix(value: string): string {
  if (!value) return value;
  let output = value.replace(/WCA ?/gi, '');
  if (CJK_RE.test(output)) {
    output = output.replace(/魔方/g, '');
    output = output.replace(/^(\d{4})年?(.+)$/, (_match, year: string, rest: string) => {
      const separator = /[A-Za-z0-9]$/.test(rest) ? ' ' : '';
      return `${rest}${separator}${year}`;
    });
  }
  return output.trim();
}

/**
 * Remove a duplicated competition year only when the host already displays
 * that same year through a date/range. The canonical data remains unchanged.
 */
export function stripCompYear(name: string, isoDateOrYear?: string | null): string {
  const year = /^(\d{4})/.exec((isoDateOrYear ?? '').trim())?.[1];
  if (!name || !year) return name;
  const output = name
    .replace(new RegExp(`\\s*${year}\\s*$`), '')
    .replace(new RegExp(`^\\s*${year}\\s*年?\\s*`), '')
    .trim();
  return output || name;
}

export interface LocalizeCompOpts {
  upcomingNameZhById?: ReadonlyMap<string, string> | null;
  explicitNameZh?: string | null;
  /** A date/year already visible beside the name; null keeps the year. */
  date?: string | null;
  resolveNameZh?(canonicalName: string): string;
  resolveNameEnFromZh?(localizedName: string): string;
}

export function resolveCompName(
  id: string,
  name: string,
  isZh: boolean,
  opts?: LocalizeCompOpts,
): string {
  if (!name) return name;
  if (!isZh) {
    if (CJK_RE.test(name)) {
      const english = opts?.resolveNameEnFromZh?.(name);
      if (english) return english;
    }
    return name;
  }
  if (opts?.explicitNameZh) return opts.explicitNameZh;
  const upcomingName = opts?.upcomingNameZhById?.get(id);
  if (upcomingName) return upcomingName;
  const mappedName = opts?.resolveNameZh?.(name);
  if (mappedName) return mappedName;
  return name;
}

export function localizeCompName(
  id: string,
  name: string,
  isZh: boolean,
  opts?: LocalizeCompOpts,
): string {
  return stripCompYear(stripWcaPrefix(resolveCompName(id, name, isZh, opts)), opts?.date);
}
