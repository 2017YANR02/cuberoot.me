// NOTE: 比赛名本地化(中文模式)——和 comp-names-zh skill 对齐的统一入口
// 4 级查表(同 GlobePage.localizeCompName):
//   1) 调用方传入的 upcomingNameZhById(可选,GlobePage 用 upcoming_comps.json 的 id→name_zh)
//   2) comp_names_zh.json 英文名→中文名(走 country_flags 里 loadFlagData 已加载的 _compNamesZh)
//   3) OpenCC 繁→简(名字本身已含 CJK 时)
//   4) 兜底原英文名
//
// 调用前需先 await loadFlagData()(country_flags 里),否则 (2) 永远 miss
//
// 显示层统一去掉 "WCA "(含尾随空格,大小写不敏感) —— stripWcaPrefix
import * as OpenCC from 'opencc-js';
import { compNameZh } from './country_flags';

const openccT2S = OpenCC.Converter({ from: 'tw', to: 'cn' });
const CJK_RE = /[㐀-鿿豈-﫿]/;

/** 比赛名 display-only 归一化：
 *  1) 去掉所有 "WCA"（含可选尾随空格，大小写不敏感）
 *  2) 含 CJK 时再去掉 "魔方"，并把开头 4 位年份移到末尾（`年` 字也吃掉）；
 *     若移完后年份紧贴 ASCII 字母/数字（罗马数字 I/II/IV 等），中间补一个空格
 *  例：`WCA Asian Championship 2024`        → `Asian Championship 2024`
 *      `2026WCA佛山魔方公开赛`              → `佛山公开赛2026`
 *      `2015WCA北京魔方公开赛`              → `北京公开赛2015`
 *      `2026WCA北京立夏魔方赛`              → `北京立夏赛2026`
 *      `2026WCA合肥三阶联赛 I`              → `合肥三阶联赛 I 2026`
 *      `2026WCA合肥三阶联赛 IV`             → `合肥三阶联赛 IV 2026`
 *  只用在显示层；搜索 / 表单提交 / 数据存储路径保留原名。
 *  历史名仍叫 stripWcaPrefix，已经是通用 display-formatter。 */
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
  /** id → name_zh 映射(GlobePage 从 upcoming_comps.json 构建) */
  upcomingNameZhById?: Map<string, string> | null;
  /** 调用方已知的 name_zh (单条 comp 自带 name_zh 字段时直接传,免去 Map 包装) */
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
    if (CJK_RE.test(name)) { try { return openccT2S(name); } catch { /* */ } }
    return name;
  })();
  return stripWcaPrefix(resolved);
}
