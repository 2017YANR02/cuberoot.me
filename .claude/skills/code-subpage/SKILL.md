---
name: code-subpage
description: "Use when adding a long-form intro page under /code/* — 一件软件/语言/算法/概念"一页一篇"。覆盖 /code/stack/* (数据驱动)、/code/language/* + /code/algorithms/* (独立路由),所有页共用 `ts_intro.css` + `stack_intro.css`,结构同构 (hero / history / concepts / why / adopters / outlook / cuberoot 用法 / links)。Triggers: \"/code\", \"/code/stack\", \"/code/language\", \"/code/algorithms\", \"stack_tools\", \"STACK_TOOLS\", \"加 stack 工具\", \"add code subpage\", \"新建语言介绍\", \"介绍 github\", \"介绍 curl\", \"介绍 vscode\", \"复刻 git.tsx\", \"复刻 TsIntroPage\"."
---

# /code/* 加新介绍页

`/code/*` 下所有长篇介绍页结构同构(语言 / stack 工具 / 算法都一样):hero 飘字 + heroStats + intro 段 + history 时间线 + concepts 卡 + why 卡 + adopters + outlook + 在 cuberoot.me 怎么用 + links。CSS 共用 `ts_intro.css` + `stack_intro.css`,**不要** 新建一份 CSS。

## 该放哪

| 主题 | 路由家 | 落地方式 |
|------|--------|---------|
| 一件软件 / 工具 / 服务 (github / curl / vscode / cmake / homebrew / claude-code 之类) | `/code/stack/<slug>` | **数据驱动 — 推荐这条** |
| 编程语言 | `/code/language/<slug>` | 独立 React 页 + App.tsx 注册 |
| 算法 | `/code/algorithms/<slug>` | 独立 React 页 + App.tsx 注册 |
| 其它跨主题概念 | 自己起 `/code/<umbrella>/<slug>` | 独立 React 页 + 加进 CodeIndexPage CARDS |

不确定就走 stack — 数据驱动是改动最小的那条路 (两文件,无新路由),github / curl / vscode 全归这里。

## Pattern A — /code/stack 数据驱动(默认走这条)

`/code/stack/:slug` 已通配,**别碰 App.tsx**。两文件:

1. **新** `core/packages/client/src/pages/code/stack_tools/<slug>.tsx`:
   - `export const SLUG: StackTool = { ... }`(完整重型对象)
   - 末尾追加 `export default SLUG;`(必须,`StackToolPage` 走 dynamic import 拿默认导出按 slug 切 chunk 实现秒开)
2. **改** `core/packages/client/src/pages/code/stack_meta.ts`:在 `STACK_TOOLS_META` 数组里加一行轻量 meta(slug/name/version/since/group/accent/bright/glyph + zh/en 的 tagline+role)。landing 卡只读这份,详情走懒加载。

slug = 文件名 = kebab-case。schema 在 `stack_tool_types.tsx` TS 强约束,缺字段 typecheck 红。`group` 选 `frontend | backend | edge | dev`(github/curl/vscode/cmake 都是 `dev`)。

参考:`stack_tools/git.tsx` 最完整,`pnpm.tsx` / `openssh.tsx` 短一点。**别再改** `stack_data.tsx`(已简化成 loader 壳,不再手维护数组)。

## Pattern B — /code/language 或 /code/algorithms 独立页

三步:

1. **新** `core/packages/client/src/pages/code/<Name>IntroPage.tsx` — 复刻 `TsIntroPage.tsx` 结构(LangCtx + `L` 组件 + 内部 HISTORY / CARDS 数组),CSS 直接 `import './ts_intro.css'` 不另起。
2. **改** `core/packages/client/src/App.tsx`:`lazy(...)` + 加 `<Route path="/code/language/<slug>" element={...}/>`(算法换 `/code/algorithms/<slug>`)。
3. **加进 landing**:语言加进 `CodeLandingPage.tsx`(`/code/language` 那张),算法加进 `AlgorithmsLandingPage.tsx`。

## 写一页需要的内容(任一 Pattern)

结构自由发挥,但跨页通用的几块是:

- **hero** — 标语 + 副标 + 几个飘字(jargon)+ 3-4 个 heroStat。
- **intro** — 2-4 段 `<p>`,讲它怎么来的、为什么存在、关键转折人物。
- **history** — 6-13 个时间点,每点带年份 + 一句标题 + 一段 desc,**最新那条** highlight。
- **concepts** — 5-9 张卡,讲它的核心抽象;不一定 git 那种"四对象+三棵树",每个主题按自己的切片来。
- **why** — 5-9 张卡,讲它为什么赢 / 为什么没死 / 用它的现实理由。
- **adopters** — 8-14 个真实用户(公司 / repo / 项目),末尾习惯放 cuberoot.me 自己 highlight。
- **outlook** — 3-5 张当下 + 未来 12 个月的看点,最新热点 `hot+big=true`。
- **在 cuberoot.me 怎么用** — 2-4 段讲它在本仓库哪里跑、踩过什么坑、跟其它工具怎么衔接。
- **links** — 3-6 个权威外链(官网 / repo / release notes / 相关项目)。

数量是量级建议不是硬指标,主题厚就多写,边缘就少写。

## 硬约束(必守)

- **不写 emoji** 任何位置(glyph 用 unicode 几何符号,icon 用单字符)。
- **中文禁 `·` 间隔号**(全局规则)。
- **内容必须真实**:历史日期 / 人名 / 版本号 / adopter / outlook 时间点。不确定就 WebFetch 官网或 GitHub releases,**禁** 凭记忆造版本号。
- `version` 写当前 stable,`since` 用 `YYYY-MM`。
- `accent` 选官方品牌色,`bright` 选 lighten 15-20%。
- 引用 cuberoot.me 自己时用真实拓扑(`RuiminYan/cuberoot.me`、`api.cuberoot.me`、`core/packages/client`、`ops/nginx/`、PG 13、Hono、pm2)。
- 公开文案禁出现:云厂商品牌 / 机房地名 / 服务器公网 IP([[feedback_no_identity_in_replies]] + [[feedback_no_proxy_words]])。
- 中英两套必须 parallel,所有 user-facing 字段 zh / en 同时写。

## 写完检查

- `pnpm --filter @cuberoot/client typecheck`(必跑,Pattern A 字段缺失会红;Pattern B 多写少写都过编译,自己看 landing 卡有没有出)。
- 不主动开浏览器验证,让用户自己看(全局规则)。
