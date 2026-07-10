// Ported from packages/client-vite/src/utils/comp_localize.ts.
// 比赛名本地化 — display-only stripWcaPrefix + 3-level zh fallback.
import { compNameZh, compNameEnFromZh } from './country-flags';

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

// 解析比赛名(zh fallback),但不剥 WCA 前缀 — 拿原始全名(如 2026WCA黄冈魔方公开赛)。
export function resolveCompName(
  id: string,
  name: string,
  isZh: boolean,
  opts?: LocalizeCompOpts,
): string {
  if (!name) return name;
  if (!isZh) {
    // Recon rows may store a Chinese comp's *Chinese* name; on the English site
    // recover the WCA canonical English name via the reverse of the zh map.
    if (CJK_RE.test(name)) {
      const en = compNameEnFromZh(name);
      if (en) return en;
    }
    return name;
  }
  if (opts?.explicitNameZh) return opts.explicitNameZh;
  const zh1 = opts?.upcomingNameZhById?.get(id);
  if (zh1) return zh1;
  const zh2 = compNameZh(name);
  if (zh2) return zh2;
  return name;
}

export function localizeCompName(
  id: string,
  name: string,
  isZh: boolean,
  opts?: LocalizeCompOpts,
): string {
  return stripWcaPrefix(resolveCompName(id, name, isZh, opts));
}
