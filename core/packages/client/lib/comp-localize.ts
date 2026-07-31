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

// 全站规则:比赛年份同时出现在页面上(同一行的日期列 / 卡片日期 / 年份分组标题)时,
// 比赛名里就不再重复那个年号 —— 「夹江公开赛2026 / 2026-07-25」重复,显示成「夹江公开赛」。
// 显示层剥掉,数据不动;只在年号与传入的年份一致时剥,免得吃掉名字里本身有意义的四位数。
// 页面上没有任何地方写着年份时(搜索下拉、无日期列的榜单)必须保留年号 —— 传 null 即可。
// 唯一实现:别在调用点手写 /\s*20\d\d\s*$/ 之类的正则(CI tests/comp-year-single-source.test.ts 会红)。
// isoDateOrYear 接受 '2026' / '2026-07-25' / '2026-07-25 ...' 任一形式。
export function stripCompYear(name: string, isoDateOrYear?: string | null): string {
  const year = /^(\d{4})/.exec((isoDateOrYear ?? '').trim())?.[1];
  if (!name || !year) return name;
  const out = name
    .replace(new RegExp(`\\s*${year}\\s*$`), '')       // 夹江公开赛2026 / Jiajiang Open 2026
    .replace(new RegExp(`^\\s*${year}\\s*年?\\s*`), '') // 2026年夹江公开赛 / 2026 Jiajiang Open
    .trim();
  return out || name;
}

export interface LocalizeCompOpts {
  upcomingNameZhById?: Map<string, string> | null;
  explicitNameZh?: string | null;
  /**
   * 页面上已经显示的该场比赛日期 / 年份('2026-07-25' 或 '2026')。传入即从比赛名里剥掉
   * 重复的年号(见 stripCompYear)。页面没显示日期时不要传 —— 年号是那里唯一的区分信息。
   */
  date?: string | null;
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
  return stripCompYear(stripWcaPrefix(resolveCompName(id, name, isZh, opts)), opts?.date);
}
