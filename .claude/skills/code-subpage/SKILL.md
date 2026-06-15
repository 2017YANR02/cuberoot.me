---
name: code-subpage
description: "Use when adding a long-form intro page under /code/* — 一件软件/语言/算法/概念“一页一篇”。全在 client (Next App Router, app/[lang]/code/*),不是退役的 Vite client。覆盖 /code/stack/* (数据驱动,3 文件)、/code/language/* + /code/algorithms/* (各自 <slug>/page.tsx 路由),结构同构 (hero / history / concepts / why / adopters / outlook / cuberoot 用法 / links)。Triggers: \"/code\", \"/code/stack\", \"/code/language\", \"/code/algorithms\", \"stack_tools\", \"STACK_TOOLS\", \"加 stack 工具\", \"add code subpage\", \"新建语言介绍\", \"介绍 github\", \"介绍 curl\", \"介绍 vscode\", \"复刻 git.tsx\", \"复刻 ts/page.tsx\"."
---

# /code/* 加新介绍页

**全部在 client**(`core/packages/client/app/[lang]/code/`,Next 16 App Router,文件即路由)。退役的 Vite `packages/client/src/pages/code/` **不要碰**。

`/code/*` 下长篇介绍页结构同构(语言 / stack 工具 / 算法都一样):hero 飘字 + heroStats + intro 段 + history 时间线 + concepts 卡 + why 卡 + adopters + outlook + 在 cuberoot.me 怎么用 + links。页面都是 `'use client'` + `useTranslation()` 取 lang + `useDocumentTitle`。

> 注意:本 skill 是给**长篇介绍页**的。功能性页面(监控面板 / 数据看板 / 运维 runbook,如已存在的 `/code/ops` `/code/traffic`)不套这套介绍页模板,自己写组件。

## 该放哪

| 主题 | 路由 | 落地方式 |
|------|------|---------|
| 一件软件 / 工具 / 服务 (github / curl / vscode / homebrew / claude-code 之类) | `/code/stack/<slug>` | **数据驱动 — 推荐这条** |
| 编程语言 | `/code/language/<slug>` | 自己的 `<slug>/page.tsx` + landing 注册 |
| 算法 | `/code/algorithms/<slug>` | 自己的 `<slug>/page.tsx` + landing 注册 |
| 其它跨主题概念 / 功能页 | `/code/<umbrella>/` | 自己的 `page.tsx` + 加进 `/code` 首页 CARDS |

Next App Router **没有 App.tsx / 路由表**:目录里放 `page.tsx` 就是路由。不确定就走 stack — 数据驱动改动最小。

## Pattern A — /code/stack 数据驱动(默认走这条)

`stack/[slug]/page.tsx` 是共用渲染壳(走 `stack_data.ts` 动态 import 按 slug 切 chunk),**别碰**。**三个文件**(Next 没有 `import.meta.glob`,比 Vite 多一步显式 loader):

1. **新** `app/[lang]/code/stack/_tools/<slug>.tsx`:
   - `const SLUG: StackTool = { ... }`(完整重型对象)
   - 末尾 `export default SLUG;`(必须,壳走 default import)
2. **改** `app/[lang]/code/stack/_lib/stack_meta.ts`:`STACK_TOOLS_META` 加一行轻量 meta(slug/name/version/since/group/accent/bright/glyph + zh/en 的 tagline+role)。landing 卡 + 壳的 hero 只读这份,详情懒加载。
3. **改** `app/[lang]/code/stack/_lib/stack_data.ts`:`LOADERS` map 加 `'<slug>': () => import('../_tools/<slug>'),`。**漏这步 = 详情页 404 / 跳回 /code/stack**(没有 glob 兜底)。

slug = 文件名 = kebab-case。schema 在 `stack/_lib/stack_tool_types.tsx` TS 强约束,缺字段 typecheck 红。`group` 选 `frontend | backend | edge | dev`(github/curl/vscode 都是 `dev`)。CSS 共用 `stack/ts_intro.css` + `stack/stack_intro.css`(壳已 import),**别新建**。参考 `_tools/git.tsx` 最完整,`pnpm.tsx` / `openssh.tsx` 短一点。**别改** `stack_data.tsx`(旧 Vite loader 壳,无关)。

## Pattern B — /code/language 或 /code/algorithms 独立页

三步:

1. **新** `app/[lang]/code/language/<slug>/page.tsx` — `'use client'`,复刻兄弟页(`language/ts/page.tsx` / `rust/page.tsx`)结构:`import { LangCtx, L, type Lang } from '../_intro/Lang'` + `useDocumentTitle` + 文件内 `HISTORY` / `CARDS` 数组。算法换 `algorithms/<slug>/page.tsx`,Lang lib 在各自上级。
2. **CSS co-locate**:同目录建 `<slug>_intro.css`(从兄弟页 copy 一份 intro 样式,按需改 accent)。**Next 每页各自一份**,不是共用 —— 别 import 别页的 css。算法用 `algorithm_intro.css`。
3. **landing 注册**(没有路由表,靠 landing 数组出卡):语言加进 `language/page.tsx` 的 `TOPICS`(slug/href/zh/en/accent/logo + `available: true`);算法加进 `algorithms/page.tsx`。

## Pattern C — 新顶层 /code/<umbrella>

`app/[lang]/code/<umbrella>/page.tsx`(自己的 page + 自己的 css)+ 在 `app/[lang]/code/page.tsx` 的 `CARDS` 数组加一张卡(href/glyph/accent/zh/en 的 title/sub/tagline/meta)。

## 写一页需要的内容(Pattern A/B)

结构自由发挥,跨页通用的几块:

- **hero** — 标语 + 副标 + 几个飘字(jargon)+ 3-4 个 heroStat。
- **intro** — 2-4 段,讲它怎么来的、为什么存在、关键转折人物。
- **history** — 6-13 个时间点,年份 + 一句标题 + 一段 desc,**最新那条** highlight。
- **concepts** — 5-9 张卡,核心抽象,每个主题按自己的切片来。
- **why** — 5-9 张卡,为什么赢 / 没死 / 用它的现实理由。
- **adopters** — 8-14 个真实用户(公司 / repo / 项目),末尾习惯放 cuberoot.me 自己 highlight。
- **outlook** — 3-5 张当下 + 未来 12 个月看点,最新热点 `hot+big=true`。
- **在 cuberoot.me 怎么用** — 2-4 段讲它在本仓库哪里跑、踩过什么坑、跟其它工具怎么衔接。
- **links** — 3-6 个权威外链。

数量是量级建议,主题厚就多写。

## 硬约束(必守)

- **不写 emoji** 任何位置(glyph 用 unicode 几何符号,icon 用单字符)。
- **中文禁 `·` 间隔号**(全局规则)。
- **内容必须真实**:历史日期 / 人名 / 版本号 / adopter / outlook 时间点。不确定就 WebFetch 官网或 GitHub releases,**禁** 凭记忆造版本号。
- `version` 写当前 stable,`since` 用 `YYYY-MM`。
- `accent` 选官方品牌色,`bright` 选 lighten 15-20%。
- 引用 cuberoot.me 自己时用真实拓扑(`RuiminYan/cuberoot.me`、`core/packages/client` 是主工作区、Next 16 App Router、`api.cuberoot.me` 走 Hono、PG 13、systemd `cuberoot-next` standalone、`ops/nginx/`)。
- 公开文案禁出现:云厂商品牌 / 机房地名 / 服务器公网 IP([[feedback_no_identity_in_replies]] + [[feedback_no_proxy_words]])。
- 中英两套必须 parallel,所有 user-facing 字段 zh / en 同时写。

## 写完检查

- `pnpm --filter @cuberoot/client typecheck`(tsgo;Pattern A 字段缺失会红;Pattern B/C 多写少写都过编译,自己看 landing 卡有没有出 + stack 详情页有没有 404)。
- dev 已在 `http://127.0.0.1:3000/`(**别** `pnpm dev`),验证用 playwright 直接开;不主动开浏览器,让用户自己看(全局规则)。
