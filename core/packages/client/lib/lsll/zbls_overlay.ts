/**
 * LSLL case → 站内 ZBLS 公式库案例的交叉引用。
 *
 * 数据 `zbls_algs.json` 由 `scripts/gen-lsll-zbls-overlay.mts` 从 3x3/zbls 集生成
 * (key = LSLL canonicalKey 的 base36,与 model.keyToString 同源),zbls 公式更新后重跑该脚本。
 * 回归见 tests/lsll_zbls_overlay.test.ts(键的 canonical 往返 + 覆盖数)。
 *
 * 单一数据源:LSLL case 页不复制公式,只指向 zbls 库(那里有正确的图 + 精选公式 + 训练器)。
 */
import raw from './zbls_algs.json';

export interface ZblsRef {
  /** zbls 案例名(如 "E T") */
  name: string;
  /** zbls 子组(如 "E+") */
  subgroup: string;
  /** 详情页短链片段:/alg/3x3/zbls/<slug> */
  slug: string;
  /** 该案例收录的公式条数 */
  algCount: number;
}

const MAP = raw as Record<string, ZblsRef[]>;

/** base36 canonical key → 该 LSLL case 对应的 zbls 案例(通常 1 个);无收录返 null。 */
export function zblsForKey(keyStr: string): ZblsRef[] | null {
  return MAP[keyStr] ?? null;
}

/** 全库收录的 LSLL case 数(= zbls 案例数)。 */
export const ZBLS_COVERED_COUNT = Object.keys(MAP).length;
