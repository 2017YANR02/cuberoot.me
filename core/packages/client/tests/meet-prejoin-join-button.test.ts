// /meet 的「进入会议」按钮不能被 meet.css 藏掉 —— 跨包 CSS 层叠守卫。
//
// 事故原型:meet.css 想藏掉 PreJoin 自带的用户名输入框(名字取自账号,改了不算数),
// 写的是 `.lk-prejoin .lk-username-container { display: none }`。而那个类名挂在一个
// <form> 上,「进入会议」这个 submit 按钮是 form 的**另一个孩子**,于是一起没了。
// 后果不是「样子难看」:join() 全站只有 PreJoin 的 onSubmit 一个调用方,按钮没了
// = 任何人在任何设备上都进不了会议,而整条功能仍然「部署成功」。
//
// typecheck / eslint / vitest / knip 谁都看不见这种事故:它发生在我们的 CSS 和第三方
// DOM 结构之间。所以判据必须同时读两边 —— 从库的产物里认出按钮的祖先链,再回来检查
// 我们的 CSS 有没有把链上任何一环整个隐藏。库升级换了结构,这里会一起红。
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/client/tests
const CLIENT = join(HERE, '..');
const MEET_CSS = join(CLIENT, 'app', '[lang]', 'meet', 'meet.css');
const PREFABS = join(CLIENT, 'node_modules', '@livekit', 'components-react', 'dist', 'prefabs.mjs');

/** 按钮所在那个 form 的类名。真实值从库产物里读,这里只是找它的锚点。 */
const JOIN_BUTTON_CLASS = 'lk-join-button';

/** meet.css 里所有把东西设成 display:none 的选择器(逗号分组已拆开)。 */
function hidingSelectors(css: string): string[] {
  // 先剥注释,否则注释里举的反例会被当成真规则。
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  for (const m of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/display\s*:\s*none/i.test(m[2]!)) continue;
    for (const sel of m[1]!.split(',')) out.push(sel.trim().replace(/\s+/g, ' '));
  }
  return out;
}

describe('meet.css must not hide the PreJoin join button', () => {
  const css = readFileSync(MEET_CSS, 'utf8');
  const prefabs = readFileSync(PREFABS, 'utf8');

  it('the join button still lives inside a container whose class we can name', () => {
    expect(prefabs, 'PreJoin 不再渲染 lk-join-button 了?库的结构变了,本守卫要跟着改')
      .toContain(JOIN_BUTTON_CLASS);
  });

  it('no rule in meet.css hides an ancestor of the join button', () => {
    // 从库产物里认出按钮的**父容器**:按钮之前最近的一个「开了一个容器元素」的
    // createElement(…) —— 兄弟节点(那个 <input>)不算,所以只认容器类的标签名。
    const upto = prefabs.slice(0, prefabs.indexOf(JOIN_BUTTON_CLASS));
    const opens = [...upto.matchAll(/createElement\(\s*"(?:form|div|section|fieldset)",\s*\{\s*className:\s*"([^"]*lk-[^"]*)"/g)];
    const container = opens.at(-1)?.[1];
    expect(container, '没能从库产物里认出 join 按钮的父容器类名 —— 库的结构变了,守卫要跟着改')
      .toBeTruthy();

    // 祖先链上的每一环:选择器**恰好落在**这一环上就是把整个子树藏掉,包括按钮。
    // 落在更深的后代上(`… > .lk-form-control`)才是我们真正想藏的那个输入框。
    const ancestors = ['lk-prejoin', ...container!.split(/\s+/)];
    const offenders = hidingSelectors(css).filter((sel) => {
      const last = sel.split(/[\s>+~]+/).filter(Boolean).at(-1) ?? '';
      return ancestors.some((cls) => last === `.${cls}` || last.endsWith(`.${cls}`));
    });

    expect(
      offenders,
      `meet.css 把「进入会议」按钮的祖先整个 display:none 了:${offenders.join(' / ')}。\n` +
        `PreJoin 把 submit 按钮和用户名输入框放在同一个 <form class="${container}"> 里,` +
        `藏掉容器 = 连按钮一起藏 = 全站没有任何入口能进会议(join() 只有它一个调用方)。\n` +
        `要藏输入框就写到输入框本身:\`.lk-prejoin .${container} > .lk-form-control\`。`,
    ).toEqual([]);
  });
});
