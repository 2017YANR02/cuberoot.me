'use client';

// 公式查询页的显示偏好 —— zustand + localStorage,形状同 bld-config-store。
//
// 与 bld-config-store 分开存:那份是**编码方案 / 缓冲**(全站 3BLD 训练器共用,改了会影响
// 读码、默写、公式表),这份纯粹是「这一页怎么显示」。混在一起会让训练器的配置被查询页
// 的开关污染。
//
// 对齐上游 /settings 的那批开关(不含 mode:穷举全集 37MB 没进仓库,只在 iframe 版有)。

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BlddbOrder } from '../_lib/blddb';

export interface BlddbPrefs {
  /** 显示「起手」列。 */
  thumb: boolean;
  /** 查单个 case 时连它的逆 case 一起列(只有三循环有逆)。 */
  inverse: boolean;
  /** 公式与换位子整体左右镜像 —— 左手党用。 */
  mirror: boolean;
  /** 通配结果的排序。 */
  order: BlddbOrder;
  /**
   * 只看「单次快于 N 秒」的人在用的写法(三阶看三盲、高阶看四盲)。空 = 不过滤。
   * 存字符串而不是数字:输入过程中的 `1.` 是合法中间态,转数字会被吃掉。
   */
  maxSecs: string;
  /**
   * 翼棱用非标准编码位置(编在 `FUr` 而不是 `UFr`)。两种约定下一条棱的两块翼互换字母,
   * 选错会静默查到另一块翼的公式,所以给到设置里。
   */
  wingAlt: boolean;
  // ── 换位子写法(上游 /settings 的 commutator 组)──
  slashNotation: boolean;
  noBrackets: boolean;
  spaceAfterColon: boolean;
  spaceAfterComma: boolean;
  outerBrackets: boolean;
}

export const DEFAULT_BLDDB_PREFS: BlddbPrefs = {
  thumb: true,
  inverse: false,
  mirror: false,
  order: 'letter',
  maxSecs: '',
  wingAlt: false,
  slashNotation: false,
  noBrackets: false,
  spaceAfterColon: false,
  spaceAfterComma: false,
  outerBrackets: false,
};

interface BlddbPrefsState {
  prefs: BlddbPrefs;
  setPrefs: (partial: Partial<BlddbPrefs>) => void;
  reset: () => void;
}

export const useBlddbPrefsStore = create<BlddbPrefsState>()(
  persist(
    (set) => ({
      prefs: { ...DEFAULT_BLDDB_PREFS },
      setPrefs: (partial) => set((s) => ({ prefs: { ...s.prefs, ...partial } })),
      reset: () => set({ prefs: { ...DEFAULT_BLDDB_PREFS } }),
    }),
    {
      name: 'blddb-prefs',
      storage: createJSONStorage(() => localStorage),
      // 与 bld-config-store 同策略:跳过自动 hydrate,页面 gate 在 hook 上,免 SSR 不匹配。
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted as Partial<BlddbPrefsState>) ?? {};
        return { ...current, prefs: { ...DEFAULT_BLDDB_PREFS, ...(p.prefs ?? {}) } };
      },
    },
  ),
);

export function useBlddbPrefsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    useBlddbPrefsStore.persist.rehydrate();
    setHydrated(true);
  }, []);
  return hydrated;
}
