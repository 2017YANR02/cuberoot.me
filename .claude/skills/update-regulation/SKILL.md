---
name: update-regulation
description: "Use when the user wants to add, rewrite, or refresh a chapter of the illustrated WCA Regulations guide at /regulation (hub + one page per chapter), OR when acting on a `regulation-drift` GitHub issue / the monthly drift check (official WCA regs changed). The user typically says \"更新规则\" then names the chapter(s) (e.g. 第十二章 转动表示方法 / 第四章 打乱 / Article 9 Events / Appendix B 盲拧). Covers: the sync/drift system (reg:check snapshot diff + the regulation_drift CI issue), the per-chapter full-clause data layer (reg:clauses + FullClauses), locating the chapter slug, fetching + paraphrasing the official article bilingually, building the page on the shared scaffold, the visualization toolkit, and the strict zh-Hant generator recipe. Triggers: \"更新规则\", \"更新規則\", \"/update-regulation\", \"加规则章节\", \"刷新规则页\", \"改规则页\", \"WCA 规则页\", \"regulation 章节\", \"第N章规则\", \"规则漂移\", \"regulation-drift\", \"reg:check\", \"reg:clauses\", \"完整条款\", \"update regulation\", \"add regulation chapter\", \"regulation page\", \"/regulation\"."
---

# 更新 /regulation(WCA 竞赛规则图解)

`/regulation` 是 WCA《竞赛规则》的逐章图文版:**总览页 + 每章一页**。全在主工作区 `core/packages/client-next/app/[lang]/regulation/`(Next 16 App Router,文件即路由)。

用户说「更新规则」后会指定章节。把章节名映射到 slug,然后**新建或重写** `<slug>/page.tsx`。内容是对官方规则的**图文介绍与翻译(自己的话转述,禁逐字照抄正文,版权)**,重点是**可视化**:动画、图示、表格、实例,不是一堵文字墙。

## 触发与同步(怎么知道该更新)

WCA 官方规则会改版(近年不按 1.1 走:有 2025-07-17 合并版、2026-04-01)。我们靠一套漂移检测保持同步,**别凭记忆**:

- **官方机器可读源**:`https://raw.githubusercontent.com/thewca/wca-regulations/official/wca-regulations.md`。顶部 `<version>Version: …`,每章是 `## <article-ID>...` 标题(附则也在同文件,标成 `Article A/B/...`),ID 正好对应我们注册表的 `num`。
- **快照基线**:`_data/reg-source.snapshot.md`(官方全文)+ `_data/reg-source.hashes.json`(版本 + 每章 sha)。= 我们「照着哪一版做的」。
- **检测**:`pnpm -F @cuberoot/client-next reg:check` —— 拉线上比基线,报告版本/哪些章改了(带 diff)+ 映射到具体 `page.tsx`;exit 0 同步 / 3 漂移 / 2 无基线 / 1 出错。
- **自动报警**:CI `.github/workflows/regulation_drift.yml` 每月 1 号跑检测,有漂移就开/更新一个 `regulation-drift` 标签的 GitHub issue,正文带 diff。**用户收到这个 issue(或主动说「更新规则」)= 本 skill 的入口。**

**收到漂移 issue / 「更新规则」时的流程**:① 先 `reg:check`(或读 issue)拿到改动清单 → ② 对每个改动章 WebFetch 官方对应 article 重新转述、重写该 `<slug>/page.tsx`(可视化照旧)→ ③ 跑下面的繁体生成 + typecheck + 浏览器验 → ④ **重新基线 + 刷新完整条款**:`pnpm -F @cuberoot/client-next reg:check --write` 再 `pnpm -F @cuberoot/client-next reg:clauses`,把更新后的 `reg-source.snapshot.md` / `reg-source.hashes.json` / `_data/reg-clauses/*.json` 一起 commit(否则下次还报同样的漂移)。新增/删除整章见末节。

## 完整条款数据层(每章可折叠全文)

每章页讲解之下有一块**「完整条款」**折叠区,逐条列官方全文(EN + 简体 + 繁體),给"查工具书"用。这层是**数据驱动、自动生成,不手写**:

- 数据源:`scripts/build-reg-clauses.mjs`(`pnpm reg:clauses`)从官方英文(本地快照)+ 官方简体翻译(`thewca/wca-regulations-translations` 的 `chinese/wca-regulations.md`,版本同步)按条款号(`4a`/`12a1a`/`A3b2`)对齐,繁體 build 时 OpenCC s2twp 生成,产出 `_data/reg-clauses/<articleId>.json`(每章一个,字段 `{id,depth,en,zh,zhHant}`)。
- 渲染:`_components/FullClauses.tsx`(原生 `<details>`,SSG/SEO 友好);每章页 `import clauses from '../_data/reg-clauses/<num>.json'` + 末尾 `<FullClauses data={clauses} />`。新建章节照此加两行。
- 中文直接来自官方翻译(不是我们逐条翻),`0 条缺中文` 即完全对齐;若官方翻译滞后会有缺口(脚本会打印 `N without 中文`)。
- 注意:`reg:clauses` 要 opencc-js(需 `pnpm install` 过),不像 `reg:check` 零依赖;本机直连 GitHub raw 偶尔超时,可 `--zh <本地文件>`(用 `gh api repos/thewca/wca-regulations-translations/contents/chinese/wca-regulations.md?ref=main -H "Accept: application/vnd.github.raw"` 拉)。

## 目录与 slug(章节名 → 路由)

单一事实源:`app/[lang]/regulation/_data/articles.ts`(`REG_ARTICLES`)。当前 16 章:

| 章 | slug | 章 | slug |
|----|------|----|------|
| 第1章 工作人员 Officials | `officials` | 第11章 意外事件 Incidents | `incidents` |
| 第2章 选手 Competitors | `competitors` | 第12章 转动表示方法 Notation | `notation` |
| 第3章 魔方 Puzzles | `puzzles` | 附则A 速拧 Speed Solving | `speed-solving` |
| 第4章 打乱 Scrambling | `scrambling` | 附则B 盲拧 Blindfolded | `blindfolded` |
| 第5章 魔方故障 Puzzle Defects | `defects` | 附则C 单手 One-Handed | `one-handed` |
| 第7章 比赛环境 Environment | `environment` | 附则E 最少步 Fewest Moves | `fewest-moves` |
| 第9章 项目 Events | `events` | 附则H 多盲 Multi-Blind | `multi-blind` |
| 第10章 完成状态 Solved State | `solved-state` | 附则I 一对一 Head to Head | `head-to-head` |

(官方现行版没有第6、8章。)WCA 官方源:`https://www.worldcubeassociation.org/regulations/full/#<anchor>` + 中文 `.../translations/chinese/#<anchor>`。先 WebFetch 让它**忠实转述**对应 article 的规则(要数字精确:时限、罚则、角度、步数),自己写双语,别整段照搬。

## 共享脚手架(复用,别每章重造)

- `_data/articles.ts` — 章节注册表(slug/num/group/title/tagline/Icon)。新增章节改这里。
- `_components/RegArticleLayout.tsx` — 每章外壳:面包屑、hero(章号徽标+标题+副标,**全从注册表来**)、上/下章导航、页脚来源声明、回总览 FAB。章节页只写正文,**别重复这些**。
- `_components/primitives.tsx` — `RegSection`(eyebrow/title/lede/children)、`Callout`(tone=info/warn/danger/success)、`RegQuote`(num)、`RegList`、`VerdictBadge`、`AngleFigure`(错位角度图)、`InspectionTimeline`(0–17s 检查轴)。
- `_components/reg-text.tsx` — `useRegText()`:章节徽标/标题/副标的本地化(badge / title / tagline)。hub + layout 用它。
- `regulation.css` — 全部共享 `.reg-*` class(reg-sec/reg-sec-title/reg-sec-lede/reg-key/reg-list/reg-quote/reg-table/reg-evt/reg-num/reg-cards/reg-card/reg-pen-grid/reg-pen-card/reg-angle-row/reg-timeline*/reg-hub-*/reg-prevnext 等)。新章直接套这些;章节专属样式才在 `<slug>/<slug>.css` 自建。

章节页骨架:
```tsx
'use client';
import { useTranslation } from 'react-i18next';
import RegArticleLayout from '../_components/RegArticleLayout';
import { RegSection, Callout, RegList } from '../_components/primitives';
import { useT } from '../../../../hooks/useT';   // ← 必须 RELATIVE,见下「繁体铁律」
export default function XPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = useT();
  return (
    <RegArticleLayout slug="<slug>">
      <RegSection eyebrow={t('小标题','Eyebrow')} title={t('标题','Title')} lede={t('一句话导语','Lede')}>
        {/* 可视化 + 内容 */}
      </RegSection>
    </RegArticleLayout>
  );
}
```

## 可视化工具箱(这一页的灵魂)

- **转动动画(notation)**:`notation/NotationMove.tsx` —— 懒加载 cubing.js TwistyPlayer,循环播放单步转动的 3D 小方块,点击重播。骨架抄 `components/CubingPreview.tsx`。puzzle id 用 cubing.js 的(`3x3x3`/`4x4x4`/`megaminx`/`pyraminx`/`skewb`...);sq1/clock 3D 不可靠,改手绘 SVG 图示。
- **错位角度**:`AngleFigure`(完成状态章用)。**检查时间轴**:`InspectionTimeline`(速拧章用)。
- **魔方图**:静态用 `<EventIcon event=.../>`(项目图标)、`components/CubingPreview`(打乱 2D net)、`@cuberoot/visualcube`(NxN 状态图)。
- **图示**:行内 SVG(VS 对决图、晋级 bracket、比赛场地图、记分公式…),`viewBox` + `max-width:100%` 防溢出。
- 卡片网格 `reg-cards`、表格 `reg-table`、罚则双栏 `reg-pen-grid`、实例图文 `reg-examples`/`reg-ex`(5b5f 那 11 张实例图在 `/public/images/regulation/`)。

## 繁体铁律(zh-Hant,本仓 OpenCC 生成,禁手敲 —— PreToolUse hook 会拦 Edit/Write 里任何繁体字)

繁体**只能**经 fs-写入的生成器进树。本页用三条受支持的通道,**别用 `<T>` 组件**(没有生成器能填它的 zhHant,zh-Hant 会回退简体):

1. **纯文本** → `const t = useT(); t('简体','English')`。**useT 必须 RELATIVE import**(`../../../../hooks/useT`,从 `<slug>/page.tsx` 数;`_components/` 同样 4 层)。**禁 `@/hooks/useT`** —— 代号生成器 `gen-localt` 解析不了 `@/` 别名,会静默跳过、繁体填不上(踩过的坑)。
2. **带标签的富 JSX**(含 `<b>`/`<K>`/`<Link>`/`<br/>`)→ 三路三目,**只写简体**两支,繁支留简体占位:
   ```tsx
   {i18n.language === 'zh-Hant' ? (简JSX) : (isZh ? (简JSX) : (enJSX))}
   ```
   组件里要有 `const { i18n } = useTranslation(); const isZh = i18n.language.startsWith('zh');`。`zh:gen-ternary` 会把第一支重写成 OpenCC 繁体。**注意**:用在 `prop={...}` 位置时别再多包一层 `{}`(`lede={i18n.language===... ? (..) : (..)}`,不是 `lede={ {..} }`)。
3. **注册表数据对象**(articles.ts 的 title/tagline)→ `{ zh, en, zhHant: '<简体副本>' }`,经 `tr()` 渲染。seed 的 zhHant 写**简体副本**(hook 放行),`zh:inject` 会刷成繁体。徽标走 `reg-text.tsx` 的模板字面量 `t(\`第 ${num} 章\`, ...)`(gen-localt 填)。

**改完依次跑(在 `core/`,缺一不可)**:
```
pnpm -F @cuberoot/client-next zh:gen-localt   # 填 t() 第三参
pnpm -F @cuberoot/client-next zh:gen-ternary  # 填三目繁支
pnpm -F @cuberoot/client-next zh:inject       # 填 tr()/数据对象 zhHant
pnpm -F @cuberoot/client-next zh:check        # 守卫:必须全绿(CI 跑这个)
```

## 新增一个全新章节(注册表里还没有)

1. `_data/articles.ts` 的 `REG_ARTICLES` 加一条:`{ slug, num, group:'core'|'event', title:{zh,en,zhHant:'<简>'}, tagline:{zh,en,zhHant:'<简>'}, Icon }`(Icon 从 lucide-react 选;`zhHant` seed 写简体副本)。顺序即阅读顺序(驱动上/下章)。
2. 建 `<slug>/page.tsx`(套骨架),并接完整条款层:`import clauses from '../_data/reg-clauses/<num>.json'` + 末尾 `<FullClauses data={clauses} />`(JSON 已由 `reg:clauses` 全量生成,含该章)。无需 generateStaticParams —— `[lang]` 层已处理,每章是静态子路由自动 SSG。
3. hub 总览页与上/下章导航**自动**带上这一章(都读注册表)。

## 其它硬约束

- 不写 emoji(用 lucide-react 图标)。中文少用 `·` 间隔号。
- 颜色只用主题 token(`var(--ink/--ink-dim/--ink-faint/--rule/--blue/--ok/--bad/--warn/--card)`),禁硬编码灰阶 hex;tint 用 `color-mix`;等宽用 `var(--font-mono)`。先调 [[theme-tokens]] skill。
- 站内链接用 `import Link from '@/components/AppLink'`(别裸 `next/link`);外链 `<a target="_blank" rel="noopener noreferrer">`。
- 必须桌面 + 手机(<480px)都好用:网格塌成 1 列、表格内部滚动、无横向溢出、点击区 ≥40px。
- 内容真实、数字精确;以官方现行版为准,页脚已声明仅供学习参考。

## 写完检查

- `pnpm -F @cuberoot/client-next typecheck`(tsgo)+ 上面的 `zh:check` 必须全绿。
- 内容随官方改版而改的话,收尾 `pnpm -F @cuberoot/client-next reg:check --write` + `pnpm -F @cuberoot/client-next reg:clauses` 重新基线 + 刷完整条款,连快照/条款 JSON 一起 commit。
- dev 常驻 `http://127.0.0.1:3000/`(**别** `pnpm dev`)。用 Playwright 开 `/zh/regulation/<slug>`、`/en/...`、`/zh-Hant/...` 各验一遍:零 console error、繁体确实是繁体、窄屏无横向溢出、动画/SVG 正常。
- 多 AI 并行时每章一个文件域,别和别的 agent 同改一个文件([[feedback_no_agent_collision]])。
