/**
 * 组名排序:同一个字母下 `+` 在 `-` 前。
 *
 * 这条规则不是审美偏好 —— 站内 zbls 公式库的入库顺序就是它(A+ A- B+ B- …),
 * 而 `localeCompare` 默认反着来。凡是在代码里排组名的地方都要走同一个比较器。
 */
import { describe, it, expect } from 'vitest';
import { compareAlgGroupLabel, sortAlgItemsBySignedLabel } from '@/lib/alg_group_order';

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

describe('sortAlgItemsBySignedLabel', () => {
  it('只交换同底名的正负 case，保留不同 case 的数据库槽位', () => {
    const rows = [
      { id: 1, name: 'B-' },
      { id: 2, name: 'A+' },
      { id: 3, name: 'B+' },
      { id: 4, name: 'A-' },
      { id: 5, name: 'C' },
    ];
    expect(sortAlgItemsBySignedLabel(rows, row => row.name).map(row => row.name))
      .toEqual(['B+', 'A+', 'B-', 'A-', 'C']);
  });

  it('显示名带括号别名时仍把 + 放在 - 前', () => {
    const rows = [{ name: 'U- (Ua)' }, { name: 'U+ (Ub)' }];
    expect(sortAlgItemsBySignedLabel(rows, row => row.name).map(row => row.name))
      .toEqual(['U+ (Ub)', 'U- (Ua)']);
  });

  it('名字中间的减号不是正负后缀，不改变原顺序', () => {
    const rows = [{ name: 'ZBLL S-13' }, { name: 'ZBLL S-2' }];
    expect(sortAlgItemsBySignedLabel(rows, row => row.name)).toEqual(rows);
  });
});
