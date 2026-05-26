// Ported from packages/client/src/utils/comp_localize.ts.
// 比赛名本地化 — display-only stripWcaPrefix + 3-level zh fallback.
import { compNameZh } from './country-flags';

const CJK_RE = /[㐀-鿿豈-﫿]/;

export function stripWcaPrefix(s: string): string {
  if (!s) return s;
  let out = s.replace(/WCA ?/gi, '');
  if (CJK_RE.test(out)) {
    out = out.replace(/魔方/g, '');
    out = out.replace(/^(\d{4})年?(.+)$/, (_, year: string, rest: string) => {
      const sep = /[A-Za-z0-9]$/.test(rest) ? ' ' : '';
      return rest + sep + year;
    });
  }
  return out.trim();
}

export interface LocalizeCompOpts {
  upcomingNameZhById?: Map<string, string> | null;
  explicitNameZh?: string | null;
}

export function localizeCompName(
  id: string,
  name: string,
  isZh: boolean,
  opts?: LocalizeCompOpts,
): string {
  if (!name) return name;
  const resolved = (() => {
    if (!isZh) return name;
    if (opts?.explicitNameZh) return opts.explicitNameZh;
    const zh1 = opts?.upcomingNameZhById?.get(id);
    if (zh1) return zh1;
    const zh2 = compNameZh(name);
    if (zh2) return zh2;
    return name;
  })();
  return stripWcaPrefix(resolved);
}
