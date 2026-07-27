/**
 * 组名排序:同一个字母下 `+` 在 `-` 前。
 *
 * 这条规则不是审美偏好 —— 站内 zbls 公式库的入库顺序就是它(A+ A- B+ B- …),
 * 而 `localeCompare` 默认反着来。凡是在代码里排组名的地方都要走同一个比较器。
 */
import { describe, it, expect } from 'vitest';
import { compareAlgGroupLabel } from '@/lib/alg_group_order';

const sorted = (xs: string[]) => [...xs].sort(compareAlgGroupLabel);

describe('compareAlgGroupLabel', () => {
  it('同字母:+ 在 - 前(默认 localeCompare 正好相反)', () => {
    expect(sorted(['A-', 'A+'])).toEqual(['A+', 'A-']);
    expect(['A-', 'A+'].sort((a, b) => a.localeCompare(b))).toEqual(['A-', 'A+']); // 反例存档
  });

  it('先字母后符号,无符号的组按字母插在中间', () => {
    expect(sorted(['G+', 'F', 'A-', 'G-', 'A+', 'E-', 'E+']))
      .toEqual(['A+', 'A-', 'E+', 'E-', 'F', 'G+', 'G-']);
  });

  it('zbls 库的入库顺序原样复现', () => {
    const db = 'A+ A- B+ B- C+ C- D+ D- E+ E- F G+ G- H+ H- I+ I- J+ J- K+ K- L+ L- M+ M- O '
      + 'P+ P- Q+ Q- R+ R- S T U+ U- V+ V- W+ W- X+ X-';
    const groups = db.split(' ');
    expect(sorted([...groups].reverse())).toEqual(groups);
  });

  it('底名带数字按数值排(不是字典序)', () => {
    expect(sorted(['OLL 10', 'OLL 2'])).toEqual(['OLL 2', 'OLL 10']);
  });

  it('前后空白不影响', () => {
    expect(compareAlgGroupLabel(' A+ ', 'A+')).toBe(0);
  });
});
