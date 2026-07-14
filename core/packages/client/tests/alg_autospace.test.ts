import { describe, it, expect } from 'vitest';
import { autoSpaceMoves, autoSpaceAfterComment, autoCloseBracket, cleanAlgText } from '@/lib/alg-autospace';

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

describe('cleanAlgText — 撇号只有一种', () => {
  // 逆时针记号全靠这个撇号。长得像它的字符有一大把,中文输入法随手就能打出来,
  // 肉眼几乎分不出 —— 进了库就是一条播不动的公式。一律折成直撇号 U+0027。
  const clean = (s: string) => cleanAlgText(s, s.length).value;

  it.each([
    ['弯撇 U+2019', 'R U’'],
    ['左弯撇 U+2018', 'R U‘'],
    ['反引号 U+0060', 'R U`'],
    ['全角反引号 U+FF40', 'R U｀'],
    ['全角撇号 U+FF07', 'R U＇'],
    ['锐音符 U+00B4', 'R U´'],
    ['prime U+2032', 'R U′'],
    ['类撇字母 U+02BC', 'R Uʼ'],
    ['修饰符 prime U+02B9', 'R Uʹ'],
    ['双引号 U+0022', 'R U"'],
    ['右弯双引号 U+201D', 'R U”'],
    ['double prime U+2033', 'R U″'],
  ])('%s → 直撇号', (_name, input) => {
    expect(clean(input)).toBe("R U'");
  });

  it('标准直撇号本来就对,不动', () => {
    expect(clean("R U' R'")).toBe("R U' R'");
  });

  it("双撇号并成一个(`R''` 没有合法含义,只可能是敲重了)", () => {
    expect(clean("R U''")).toBe("R U'");
    expect(clean("R U'''")).toBe("R U'");
    // 混着来的也一样:双引号先折成撇号,再并
    expect(clean('R U"’')).toBe("R U'");
  });

  it("`R2'` 不受影响 —— 那是 `2'`,不是 `''`", () => {
    expect(clean("R2' U2'")).toBe("R2' U2'");
  });

  it('注释里的两撇不动(人话里 \'\' 可以是引号)', () => {
    expect(clean("R U' // 叫做 ''sune''")).toBe("R U' // 叫做 ''sune''");
  });

  it('一整条混着几种撇号的公式,全折平', () => {
    expect(clean("R U’ R` U´ R′")).toBe("R U' R' U' R'");
  });

  it('注释里的弯撇号不动 —— 那是人话的一部分', () => {
    expect(clean("R U' // don’t regrip")).toBe("R U' // don’t regrip");
  });

  it('零宽字符(粘贴带进来的)照删', () => {
    expect(clean('A​B‌C‍D﻿E')).toBe('ABCDE');
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

describe('cleanAlgText — 中文输入法漏进来的字符', () => {
  // 网页改不了系统输入法(Chrome 不认 ime-mode),只能保证「打不进来」。
  const clean = (s: string) => cleanAlgText(s, s.length).value;

  it('全角字母 / 数字 → 半角', () => {
    expect(clean('Ｒ Ｕ２ Ｒ')).toBe('R U2 R');
  });

  it('中文输入法的弯引号 → 直引号(最阴的一种:肉眼几乎看不出)', () => {
    expect(clean('R U’ R’')).toBe("R U' R'");
    expect(clean('R U‘ R')).toBe("R U' R");
  });

  it('全角空格 → 普通空格', () => {
    expect(clean('R　U')).toBe('R U');
  });

  it('汉字直接删,公式本身留着', () => {
    expect(clean('R U 右手 R\'')).toBe("R U  R'");
    expect(clean('打乱')).toBe('');
  });

  it('中文标点删掉 / 映射,不残留', () => {
    expect(clean('R，U。')).toBe('R,U.');
    expect(clean('R U（R）')).toBe('R U(R)');
  });

  it('换握标注 ↑↓· 是公式的一部分,不能删', () => {
    expect(clean("R U↑ R'·")).toBe("R U↑ R'·");
  });

  it('干净的公式原样返回(引用相同,不白洗一遍)', () => {
    const s = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const r = cleanAlgText(s, 3);
    expect(r.value).toBe(s);
    expect(r.cursor).toBe(3);
  });

  it('光标按清洗后的前缀重算 —— 在中间删字不该把光标甩到行尾', () => {
    //            0123456
    const s = 'R 右手 U';       // 光标停在「手」后面(index 4)
    const r = cleanAlgText(s, 4);
    expect(r.value).toBe('R  U');
    expect(r.cursor).toBe(2);  // 'R ' 洗完剩 2 个字符
  });

  it('零宽字符(粘贴带进来的)一并删掉', () => {
    expect(clean('R​U')).toBe('RU');
  });
});

describe('cleanAlgText — `//` 之后是注释,中文照写', () => {
  // /recon/submit 的「解法」框:注释就是拿来写人话的。提交时的校验器
  // (findIllegalNotationChars)本来就只管 `//` 之前,输入清洗必须跟它一致。
  const clean = (s: string) => cleanAlgText(s, s.length).value;

  it('注释里的中文一个字都不动', () => {
    expect(clean("R U R' // 插右前槽")).toBe("R U R' // 插右前槽");
  });

  it('注释里的全角标点也不动(那是人话,不是记号)', () => {
    expect(clean('R U // 先做十字,再插槽。')).toBe('R U // 先做十字,再插槽。');
  });

  it('招式区照洗,注释区照留 —— 同一行里两套规矩', () => {
    // 汉字删掉后两边的空格都留着(只删字符,不合并空白 —— toMoveString 吃得下多余空格)
    expect(clean('Ｒ U’ 右 R // 右手 R’')).toBe("R U'  R // 右手 R’");
  });

  it('换行结束注释,下一行回到招式区', () => {
    expect(clean("R // 注释\nＵ 汉字 R'")).toBe("R // 注释\nU  R'");
  });

  it('多行解法:每行各自判注释', () => {
    const s = "y' // 转体\nR U R' // 第一组\nU2 汉字 R";
    expect(clean(s)).toBe("y' // 转体\nR U R' // 第一组\nU2  R");
  });

  it('单个 / 不是注释,照洗', () => {
    expect(clean('R / 汉字')).toBe('R / ');
  });

  it('光标在注释里也算得对', () => {
    const s = "Ｒ U // 注释";
    const r = cleanAlgText(s, s.length);
    expect(r.value).toBe('R U // 注释');
    expect(r.cursor).toBe(r.value.length);
  });
});
