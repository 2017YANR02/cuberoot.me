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

import { cubeColorGroups, f2lDisplayColors, isCubeColorLetters, leadingCubeColors } from '@/components/CubeColorChip/CubeColorChip';

describe('leadingCubeColors', () => {
  it('两片配色的标注 → 两个字母', () => {
    expect(leadingCubeColors('GR')).toBe('GR');
    expect(leadingCubeColors('OB')).toBe('OB');
    expect(leadingCubeColors('OB+RG')).toBe('OB');
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

describe('cubeColorGroups', () => {
  it('找出 xxcross 与连续 F2L 标注里的每一组颜色', () => {
    expect(cubeColorGroups('Y xxcross (BR+GO)')).toEqual([
      { colors: 'Y', start: 0, end: 1 },
      { colors: 'BR', start: 11, end: 13 },
      { colors: 'GO', start: 14, end: 16 },
    ]);
    expect(cubeColorGroups('OB+RG')).toEqual([
      { colors: 'OB', start: 0, end: 2 },
      { colors: 'RG', start: 3, end: 5 },
    ]);
  });

  it('不把末层 case 或注释里的单个转动字母当颜色', () => {
    expect(cubeColorGroups('OLL-V+')).toEqual([]);
    expect(cubeColorGroups('PLL-A+')).toEqual([]);
    expect(cubeColorGroups('cancel into R U')).toEqual([]);
  });
});

describe('f2lDisplayColors', () => {
  it('白底四槽按贴纸的视觉左右顺序显示', () => {
    expect(f2lDisplayColors('RB')).toBe('BR');
    expect(f2lDisplayColors('RG')).toBe('GR');
    expect(f2lDisplayColors('BO')).toBe('OB');
    expect(f2lDisplayColors('OG')).toBe('GO');
  });

  it('单色十字和未知组合保持原顺序', () => {
    expect(f2lDisplayColors('W')).toBe('W');
    expect(f2lDisplayColors('WY')).toBe('WY');
  });
});
