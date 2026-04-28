// NOTE: 比赛名本地化(中文模式)——和 cn-comp-names skill 对齐的统一入口
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

/** 比赛名 display-only：去掉所有 "WCA "（尾随空格，大小写不敏感）。
 *  例：`WCA Asian Championship 2024` → `Asian Championship 2024`。
 *  只用在显示层；搜索 / 表单提交 / 数据存储路径保留原名。 */
export function stripWcaPrefix(s: string): string {
  if (!s) return s;
  return s.replace(/WCA /gi, '').trim();
}

export interface LocalizeCompOpts {
  /** id → name_zh 映射(GlobePage 从 upcoming_comps.json 构建) */
  upcomingNameZhById?: Map<string, string> | null;
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
    const zh1 = opts?.upcomingNameZhById?.get(id);
    if (zh1) return zh1;
    const zh2 = compNameZh(name);
    if (zh2) return zh2;
    if (CJK_RE.test(name)) { try { return openccT2S(name); } catch { /* */ } }
    return name;
  })();
  return stripWcaPrefix(resolved);
}
