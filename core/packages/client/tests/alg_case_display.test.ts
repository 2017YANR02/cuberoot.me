import { describe, it, expect } from 'vitest';
import {
  displayOllName, displayPllName, ollCommentName, pllCommentName,
  displayAlgCaseName, OLL_NAME_BY_NUMBER, isEpll, pllCommentLabel,
} from '@/lib/alg_case_display';

describe('OLL 英文名 + 编号展示', () => {
  it('OLL 1 → DH (1)', () => {
    expect(displayOllName('OLL 1')).toBe('DH (1)');
  });
  it('OLL 27 → S+ (27)', () => {
    expect(displayOllName('OLL 27')).toBe('S+ (27)');
  });
  it('OLL 57 → B (57)', () => {
    expect(displayOllName('OLL 57')).toBe('B (57)');
  });
  it('1..57 全部有英文名', () => {
    for (let n = 1; n <= 57; n++) expect(OLL_NAME_BY_NUMBER[n]).toBeTruthy();
  });
  it('英文名两两不重复', () => {
    const names = Object.values(OLL_NAME_BY_NUMBER);
    expect(new Set(names).size).toBe(names.length);
  });
  it('非 OLL 编号格式原样返回', () => {
    expect(displayOllName('Gd')).toBe('Gd');
  });
});

describe('PLL 改名展示', () => {
  it('Aa → A+ (Aa)', () => expect(displayPllName('Aa')).toBe('A+ (Aa)'));
  it('Ab → A- (Ab)', () => expect(displayPllName('Ab')).toBe('A- (Ab)'));
  it('Ua → U- (Ua)', () => expect(displayPllName('Ua')).toBe('U- (Ua)'));
  it('Ub → U+ (Ub)', () => expect(displayPllName('Ub')).toBe('U+ (Ub)'));
  it('未改名原样', () => {
    expect(displayPllName('Gd')).toBe('Gd');
    expect(displayPllName('E')).toBe('E');
  });
});

describe('recon 注释精确 case 名', () => {
  it('OLL 27 → S+(给 // OLL-S+)', () => expect(ollCommentName('OLL 27')).toBe('S+'));
  it('PLL Gd → Gd(给 // PLL-Gd)', () => expect(pllCommentName('Gd')).toBe('Gd'));
  it('PLL Aa → A+(改名后注释也跟着改)', () => expect(pllCommentName('Aa')).toBe('A+'));
});

describe('EPLL 前缀(U+/U-/H/Z 加 E)', () => {
  it('isEpll:DB 原名 Ua/Ub/H/Z 都算 EPLL', () => {
    expect(isEpll('Ua')).toBe(true);
    expect(isEpll('Ub')).toBe(true);
    expect(isEpll('H')).toBe(true);
    expect(isEpll('Z')).toBe(true);
  });
  it('isEpll:展示名 U+/U- 也算', () => {
    expect(isEpll('U+')).toBe(true);
    expect(isEpll('U-')).toBe(true);
  });
  it('isEpll:非 EPLL 为 false', () => {
    expect(isEpll('Gd')).toBe(false);
    expect(isEpll('Aa')).toBe(false);
    expect(isEpll('E')).toBe(false);
  });
  it('pllCommentLabel:EPLL 加 E 前缀 + 改名', () => {
    expect(pllCommentLabel('Ub')).toBe('EPLL-U+');
    expect(pllCommentLabel('Ua')).toBe('EPLL-U-');
    expect(pllCommentLabel('H')).toBe('EPLL-H');
    expect(pllCommentLabel('Z')).toBe('EPLL-Z');
  });
  it('pllCommentLabel:非 EPLL 用 PLL 前缀', () => {
    expect(pllCommentLabel('Gd')).toBe('PLL-Gd');
    expect(pllCommentLabel('Aa')).toBe('PLL-A+');
  });
});

describe('displayAlgCaseName 按 set 路由', () => {
  it('3x3 oll 走 OLL 变换', () => expect(displayAlgCaseName('3x3', 'oll', 'OLL 24')).toBe('T (24)'));
  it('3x3 pll 走 PLL 变换', () => expect(displayAlgCaseName('3x3', 'pll', 'Ua')).toBe('U- (Ua)'));
  it('其它 set 原样', () => expect(displayAlgCaseName('3x3', 'f2l', 'F2L 1')).toBe('F2L 1'));
});
