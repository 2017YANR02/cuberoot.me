/**
 * 标注开头的色字母 —— 摆色块之前先得认对是哪几个字母。
 * =========================================================================
 *
 * 复盘的标注是 cubedb 那套写法,一条里可能出现的东西混得很杂:
 *
 *     GR              一对 F2L 的两片侧贴纸
 *     W cross         十字的颜色
 *     W xcross (RB+GO)
 *     RB/ZBLS
 *     OLL-F-  PLL-T  EPLL-Z   末层 case 名
 *
 * 前四类该摆色块,后一类**一个都不许摆** —— 而 `O`(橙)恰好是 `OLL-…` 的首字母,
 * `B`(蓝)是不少 case 名的首字母。所以这个判据的失败方式是「给 OLL 摆一个橙块」,
 * 看着像功能正常、其实在骗人。这里把两边都钉死。
 */
import { describe, it, expect } from 'vitest';

import { isCubeColorLetters, leadingCubeColors } from '@/components/CubeColorChip/CubeColorChip';

describe('leadingCubeColors', () => {
  it('两片配色的标注 → 两个字母', () => {
    expect(leadingCubeColors('GR')).toBe('GR');
    expect(leadingCubeColors('OB')).toBe('OB');
    expect(leadingCubeColors('RB/ZBLS')).toBe('RB');
  });

  it('十字那一行 → 一个字母', () => {
    expect(leadingCubeColors('W cross')).toBe('W');
    expect(leadingCubeColors('Y cross')).toBe('Y');
    expect(leadingCubeColors('W xcross (RB+GO)')).toBe('W');
  });

  it('末层 case 名一个都不中 —— 这是这条判据真正要防的', () => {
    for (const label of ['OLL-F-', 'OLL-K2', 'PLL-T', 'EPLL-Z', 'PLL-E', 'ZBLL-Pi61', 'OLL Skip']) {
      expect(leadingCubeColors(label), label).toBeNull();
    }
  });

  it('三个及以上字母不算配色 —— 那是别的东西', () => {
    expect(leadingCubeColors('WYG')).toBeNull();
    expect(leadingCubeColors('')).toBeNull();
  });

  it('isCubeColorLetters 只认 1~2 个真色字母', () => {
    expect(isCubeColorLetters('G')).toBe(true);
    expect(isCubeColorLetters('GR')).toBe(true);
    expect(isCubeColorLetters('GX')).toBe(false);
    expect(isCubeColorLetters('GRB')).toBe(false);
    expect(isCubeColorLetters('')).toBe(false);
  });
});
