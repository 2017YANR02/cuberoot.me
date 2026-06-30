// i18n 约定守卫(ratchet):禁止「全局 UI 语言的内联文案三元」继续增加。
//
// 反模式(以后的 AI 禁写):把可见文案直接塞进一个由全局语言驱动的三目——
//     isZh ? '中文' : 'English'
//     i18n.language.startsWith('zh') ? obj.zh : obj.en
//     i18n.language === 'zh' ? <>中文</> : <>EN</>
// 正确写法统一走单一 chokepoint:
//     行内字符串      → tr({ en, zh })            （i18n/tr.tsx）
//     行内 JSX        → <T en={...} zh={...} />   （i18n/tr.tsx）
//     组件内回调      → const t = useT(); t(zh, en)
//     跨页复用/插值   → t('ns.key') + en.json/zh.json
//     双语数据对象    → tr(obj)  // obj 形如 { en, zh }
//
// 为什么:内联三元易写反顺序、易漏一种语言、无类型约束,且散落各处无法统一切换/审计。
// 全部收口到 tr()/<T>/useT()/t() 后,文案有单一出口。
//
// 这是 ratchet(棘轮):BASELINE 锁住当前存量,只能降不能升。
//   - 新增一处 → 计数 > BASELINE → CI 红。改走 tr()/<T>/useT()。
//   - 迁移一处 → 计数 < BASELINE → CI 红,提示把 BASELINE 调低(把消减当 review 信号,
//     符合本仓「改 baseline 当 review 信号,别改宽容」约定)。
//
// 只数「文案」三元(字面量 CJK 对 / JSX 分支 / `obj.zh`:`obj.en` 双语对象),不数:
//   - 函数参数 isZh(util 契约,如 displayCuberName(name, isZh));
//   - 非 CJK 字面量对(locale code / 纯英文变体等逻辑);
//   - 其它 dynamic 逻辑三元(isZh ? 16 : 12 字号之类)。
// CI 跑 vitest(不跑 eslint),故约定靠本测试守。配套:写入即拦 PreToolUse hook
// scripts/hook-detect-traditional.mjs;文案规范见 skill i18n。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const HAS_CJK = /[㐀-鿿豈-﫿]/;

const refsLanguage = (t: string) => /\.language\b/.test(t);

// `isZh` is the GLOBAL UI language only when it's a const initialised from
// `.language` in this file — NOT a function parameter / prop (that carries an
// explicit caller-supplied value and is a legitimate util contract).
function isGlobalLangIdent(id: Node): boolean {
  const name = id.getText();
  let fn = id.getFirstAncestor((a) =>
    Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) ||
    Node.isFunctionExpression(a) || Node.isMethodDeclaration(a));
  while (fn) {
    for (const p of (fn as import('ts-morph').FunctionLikeDeclaration).getParameters()) {
      if (p.getName() === name) return false; // shadowed by a parameter → not global
    }
    fn = fn.getFirstAncestor((a) =>
      Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) ||
      Node.isFunctionExpression(a) || Node.isMethodDeclaration(a));
  }
  for (const vd of id.getSourceFile().getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    if (vd.getName() !== name) continue;
    const init = vd.getInitializer();
    if (init && refsLanguage(init.getText())) return true;
  }
  return false;
}

// Returns which branch (whenTrue) is shown to Chinese users, or null if the test
// is not the global UI language.
function senseOfTest(test: Node): 'zh' | 'en' | null {
  if (Node.isCallExpression(test)) {
    const e = test.getExpression();
    return Node.isPropertyAccessExpression(e) && e.getName() === 'startsWith' && refsLanguage(e.getExpression().getText()) ? 'zh' : null;
  }
  if (Node.isBinaryExpression(test)) {
    const op = test.getOperatorToken().getText();
    if (op !== '===' && op !== '==') return null;
    const l = test.getLeft(), r = test.getRight();
    const lit = Node.isStringLiteral(l) ? l : Node.isStringLiteral(r) ? r : null;
    if (!lit) return null;
    const o = lit === l ? r : l;
    const v = lit.getLiteralValue();
    if (!refsLanguage(o.getText())) return null;
    return v === 'zh' ? 'zh' : v === 'en' ? 'en' : null;
  }
  if (Node.isIdentifier(test) && test.getText() === 'isZh') return isGlobalLangIdent(test) ? 'zh' : null;
  if (Node.isPrefixUnaryExpression(test) && test.getOperatorToken() === SyntaxKind.ExclamationToken) {
    const o = test.getOperand();
    return Node.isIdentifier(o) && o.getText() === 'isZh' && isGlobalLangIdent(o) ? 'en' : null;
  }
  return null;
}

const isStr = (n: Node) => Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n);
const isJsx = (n: Node) =>
  Node.isJsxElement(n) || Node.isJsxFragment(n) || Node.isJsxSelfClosingElement(n) ||
  (Node.isParenthesizedExpression(n) && /^[\s(]*</.test(n.getText()));
// member access ending in `.zh` / `.en` (a bilingual data object: obj.zh : obj.en)
const endsWith = (n: Node, k: 'zh' | 'en') => Node.isPropertyAccessExpression(n) && n.getName() === k;

// Is this conditional a *text* ternary that must go through tr()/<T>/useT()?
function isTextTernary(ce: import('ts-morph').ConditionalExpression, sense: 'zh' | 'en'): boolean {
  const a = ce.getWhenTrue(), b = ce.getWhenFalse();
  const zh = sense === 'zh' ? a : b;
  const en = sense === 'zh' ? b : a;
  // literal/literal pair where the zh branch contains CJK
  if (isStr(a) && isStr(b)) {
    const v = (Node.isStringLiteral(zh) || Node.isNoSubstitutionTemplateLiteral(zh)) ? zh.getLiteralValue() : '';
    return HAS_CJK.test(v);
  }
  // a JSX branch is always UI
  if (isJsx(a) || isJsx(b)) return true;
  // bilingual data object: `cond ? obj.zh : obj.en`
  if (endsWith(zh, 'zh') && endsWith(en, 'en')) return true;
  return false;
}

describe('i18n: no new inline UI-language text ternaries (use tr / <T> / useT / t)', () => {
  it('count of global-language text ternaries does not exceed the frozen baseline', () => {
    // Fully migrated 2026-06-14 (codemod-isz-burndown.mjs, 419 → 0). Keep at 0:
    // any new inline UI-language text ternary fails CI — use tr()/<T>/useT()/t().
    const BASELINE = 0;

    const project = new Project({ skipAddingFilesFromTsConfig: true });
    for (const d of ['app', 'components', 'lib', 'hooks']) {
      project.addSourceFilesAtPaths([join(ROOT, d, '**/*.tsx'), join(ROOT, d, '**/*.ts')]);
    }
    const offenders: string[] = [];
    for (const sf of project.getSourceFiles()) {
      for (const ce of sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
        const sense = senseOfTest(ce.getCondition());
        if (!sense || !isTextTernary(ce, sense)) continue;
        offenders.push(
          `${sf.getFilePath().replace(/.*client[\\/]/, '')}:${ce.getStartLineNumber()}  ${ce.getText().slice(0, 64).replace(/\s+/g, ' ')}`,
        );
      }
    }
    expect(
      offenders.length,
      offenders.length > BASELINE
        ? `新增了 ${offenders.length - BASELINE} 处内联 UI 语言文案三元。请改走 tr({ en, zh }) / <T en zh /> / useT() / t()。\n` +
          `(若确实是迁移导致减少,把 BASELINE 调到 ${offenders.length}。)\n` +
          offenders.slice(-20).join('\n')
        : `已迁移 ${BASELINE - offenders.length} 处,请把 BASELINE 从 ${BASELINE} 调低到 ${offenders.length}(消减当 review 信号)。`,
    ).toBe(BASELINE);
  });
});
