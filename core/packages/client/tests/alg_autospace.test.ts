import { describe, it, expect } from 'vitest';
import { autoSpaceMoves, autoSpaceAfterComment, autoCloseBracket, stripZeroWidth } from '@/lib/alg-autospace';

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

  it('反向 DU / BF 也连写(U-D、F-B 两条轴两个方向都豁免)', () => {
    expect(typed('DU').value).toBe('DU');
    expect(typed("D2U").value).toBe('D2U');
    expect(typed('BF').value).toBe('BF');
    expect(typed("B'F").value).toBe("B'F");
  });

  it('R/L 轴仍照常加空格(只有 U-D、F-B 例外)', () => {
    expect(typed('RL').value).toBe('R L');
    expect(typed('LR').value).toBe('L R');
  });

  it('前缀有其它转动时,末尾 U..D 仍连写', () => {
    // 已有 "R U'",刚输入 D → 不应在 U' 与 D 间加空格
    expect(autoSpaceMoves("R U'D", 5, 'insertText').value).toBe("R U'D");
  });

  it("右括号后接转动时补空格(右括号后输入 R 补空格)", () => {
    expect(autoSpaceMoves("(U U')R", 7, 'insertText').value).toBe("(U U') R");
  });

  it('注释里不加空格', () => {
    expect(typed('// RL').value).toBe('// RL');
  });
});

describe('stripZeroWidth — 零宽字符输入即删', () => {
  it('删掉零宽并回退光标', () => {
    // "R​U" 光标在末尾(3)→ 删掉零宽后变 "RU" 光标 2
    const r = stripZeroWidth('R​U', 3);
    expect(r.value).toBe('RU');
    expect(r.cursor).toBe(2);
  });

  it('多种零宽都删(200B/200C/200D/FEFF)', () => {
    expect(stripZeroWidth('A​B‌C‍D﻿E', 9).value).toBe('ABCDE');
  });

  it('无零宽时原样返回', () => {
    const r = stripZeroWidth("R U R'", 6);
    expect(r.value).toBe("R U R'");
    expect(r.cursor).toBe(6);
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

  it('左括号前紧贴非空白时先补空格(// BO( → // BO ())', () => {
    // "// BO(" 光标 6 → 先补空格成 "// BO (",再补右括号 "// BO ()",光标停在 7
    expect(autoCloseBracket('// BO(', 6, 'insertText')).toEqual({ value: '// BO ()', cursor: 7 });
    // 转动后同理:"R(" → "R ()"
    expect(autoCloseBracket('R(', 2, 'insertText')).toEqual({ value: 'R ()', cursor: 3 });
  });

  it('左括号前已是空格 / 行首时不重复补空格', () => {
    expect(autoCloseBracket('R (', 3, 'insertText')).toEqual({ value: 'R ()', cursor: 3 });
    expect(autoCloseBracket('(', 1, 'insertText')).toEqual({ value: '()', cursor: 1 });
  });

  it('非左括号 / 非 insertText 不动', () => {
    expect(autoCloseBracket('R', 1, 'insertText').value).toBe('R');
    expect(autoCloseBracket('(', 1, 'insertFromPaste').value).toBe('(');
  });
});
