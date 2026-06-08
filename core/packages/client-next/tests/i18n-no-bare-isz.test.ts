// i18n 约定守卫:禁止新增「裸 CJK 文案三目」—— 即
//     isZh ? '中文' : 'English'   /   i18n.language.startsWith('zh') ? '中文' : 'en'
// 直接把中文硬编码进 JSX/表达式。全站可见文案统一走单一 chokepoint:
//   - 行内字面量 → tr({ en, zh, zhHant? })（构建期注入 zhHant，见 scripts/inject-zhhant.mjs）
//   - 动态 / 数据 / JSX → `i18n.language === 'zh-Hant' ? (繁) : (原三目)` 三路（构建期 OpenCC）
// 这样繁体（zh-Hant）才有完整覆盖、SSR/客户端同形、无 hydration 闪烁。
//
// 本测试当红灯:谁再写 `isZh ? '中' : 'en'` 字面量对而不走 tr() → CI 直接挂。
// CI 跑 vitest(不跑 eslint),故约定靠本测试守。
import { describe, it, expect } from 'vitest';
import { Project, SyntaxKind, Node } from 'ts-morph';
import * as OpenCC from 'opencc-js';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client-next
const HAS_CJK = /[㐀-鿿豈-﫿]/;
const toTrad = OpenCC.Converter({ from: 'cn', to: 'twp' });
// A real Traditional gap = the Chinese branch differs under s2twp. 简繁同形 text
// (新 / 未知 / PB …) renders identically on zh-Hant, so it's not a gap — matching
// exactly what the conversion codemods skip.
const isRealGap = (s: string) => HAS_CJK.test(s) && toTrad(s) !== s;
const refsLang = (t: string) => /\.language\b/.test(t);

// returns 'zh' if the whenTrue branch is the one shown to Chinese users, 'en' if
// whenFalse is, null if not a language ternary.
function senseDir(test: Node): 'zh' | 'en' | null {
  if (Node.isCallExpression(test)) {
    const e = test.getExpression();
    return Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && refsLang(e.getExpression().getText()) ? 'zh' : null;
  }
  if (Node.isIdentifier(test) && test.getText() === 'isZh') return 'zh';
  if (Node.isPrefixUnaryExpression(test) && test.getOperatorToken() === SyntaxKind.ExclamationToken) {
    const o = test.getOperand();
    return Node.isIdentifier(o) && o.getText() === 'isZh' ? 'en' : null;
  }
  if (Node.isBinaryExpression(test)) {
    const op = test.getOperatorToken().getText();
    if (op !== '===' && op !== '==') return null;
    const l = test.getLeft(), r = test.getRight();
    const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null;
    if (!lit) return null;
    const o = lit === l ? r : l;
    const v = (lit as import('ts-morph').StringLiteral).getLiteralValue();
    if (!refsLang(o.getText())) return null;
    return v === 'zh' ? 'zh' : v === 'en' ? 'en' : null;
  }
  return null;
}

// 已在 `... === 'zh-Hant' ? (繁) : (...)` 三路 else 分支里的内层三目 = 已覆盖,跳过
function covered(ce: Node): boolean {
  let up = ce.getParent();
  while (up && Node.isParenthesizedExpression(up)) up = up.getParent();
  return !!up && Node.isConditionalExpression(up) && /zh-Hant/.test(up.getCondition().getText());
}

describe('i18n: no bare CJK isZh string ternaries', () => {
  it('every inline Chinese literal goes through tr() / a 3-way, not a raw isZh ternary', () => {
    const project = new Project({ skipAddingFilesFromTsConfig: true });
    for (const d of ['app', 'components', 'lib', 'hooks']) {
      project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
    }
    const offenders: string[] = [];
    const isStr = (n: Node) => Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n);
    for (const sf of project.getSourceFiles()) {
      for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
        const dir = senseDir(ce.getCondition());
        if (!dir || covered(ce)) continue;
        const a = ce.getWhenTrue(), b = ce.getWhenFalse();
        if (!isStr(a) || !isStr(b)) continue;            // only literal/literal pairs
        const zhBranch = dir === 'zh' ? a : b;            // the branch shown to Chinese users
        if (!isRealGap(zhBranch.getText())) continue;     // only a real Traditional gap
        offenders.push(
          `${sf.getFilePath().replace(/.*client-next[\\/]/, '')}:${ce.getStartLineNumber()}  ${ce.getText().slice(0, 70).replace(/\s+/g, ' ')}`,
        );
      }
    }
    expect(offenders, `Use tr({ en, zh }) instead of a raw isZh ternary:\n${offenders.join('\n')}`).toEqual([]);
  });
});
