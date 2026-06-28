import { describe, it, expect } from 'vitest';
import { autoSpaceMoves, autoSpaceAfterComment, autoCloseBracket } from '@/lib/alg-autospace';

describe('autoSpaceMoves — 相邻转动自动加空格', () => {
  // 模拟「刚输入第二步那个面字母」后的一次 onInput 调用
  const typed = (value: string) => autoSpaceMoves(value, value.length, 'insertText');

  it('RL 之间加空格(普通相邻面)', () => {
    expect(typed('RL').value).toBe('R L');
  });

  it('UD / FB 连写不加空格(同轴对面)', () => {
    expect(typed('UD').value).toBe('UD');
    expect(typed('FB').value).toBe('FB');
  });

  it("带修饰符的 U..D / F..B 也连写", () => {
    expect(typed("U'D").value).toBe("U'D");
    expect(typed('U2D').value).toBe('U2D');
    expect(typed("U2'D").value).toBe("U2'D");
    expect(typed("F'B'").value).toBe("F'B'");
    expect(typed('F2B').value).toBe('F2B');
  });

  it('反向 DU / BF 仍加空格(只豁免 UD / FB 有序对)', () => {
    expect(typed('DU').value).toBe('D U');
    expect(typed('BF').value).toBe('B F');
  });

  it('前缀有其它转动时,末尾 U..D 仍连写', () => {
    // 已有 "R U'",刚输入 D → 不应在 U' 与 D 间加空格
    expect(autoSpaceMoves("R U'D", 5, 'insertText').value).toBe("R U'D");
  });

  it('注释里不加空格', () => {
    expect(typed('// RL').value).toBe('// RL');
  });
});

describe('autoSpaceAfterComment — // 后补空格', () => {
  it('// 后紧跟内容时补一个空格,光标后移', () => {
    const r = autoSpaceAfterComment('R //x', 5, 'insertText');
    expect(r.value).toBe('R // x');
    expect(r.cursor).toBe(6);
  });

  it('已有空格不重复补', () => {
    expect(autoSpaceAfterComment('R // xy', 7, 'insertText').value).toBe('R // xy');
  });

  it('输入第二个 / 时不补空格', () => {
    expect(autoSpaceAfterComment('R //', 4, 'insertText').value).toBe('R //');
  });

  it('非 insertText(粘贴/删除)不动', () => {
    expect(autoSpaceAfterComment('R //x', 5, 'insertFromPaste').value).toBe('R //x');
  });
});

describe('autoCloseBracket — 左括号自动补右括号', () => {
  it('( [ { 自动补对应右括号,光标停在中间', () => {
    expect(autoCloseBracket('(', 1, 'insertText')).toEqual({ value: '()', cursor: 1 });
    expect(autoCloseBracket('[', 1, 'insertText')).toEqual({ value: '[]', cursor: 1 });
    expect(autoCloseBracket('{', 1, 'insertText')).toEqual({ value: '{}', cursor: 1 });
  });

  it('在已有内容后补括号', () => {
    expect(autoCloseBracket('R (', 3, 'insertText')).toEqual({ value: 'R ()', cursor: 3 });
  });

  it('非左括号 / 非 insertText 不动', () => {
    expect(autoCloseBracket('R', 1, 'insertText').value).toBe('R');
    expect(autoCloseBracket('(', 1, 'insertFromPaste').value).toBe('(');
  });
});
