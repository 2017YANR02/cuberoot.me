---
name: i18n
description: "Use when adding/editing user-visible text in the React client (core/packages/client). 站点只服 en + zh-Hans(简体);繁体已移除。文案统一走 tr({en,zh}) / <T en zh /> / useT() 的 t(zh,en) / t('ns.key')+en.json/zh.json。禁内联 isZh/i18n.language 文案三元(CI ratchet + PreToolUse hook 双守)。右上角 lang+theme 用 <HeaderToggles />。Triggers: \"中英双语\", \"双语\", \"i18n\", \"translate\", \"翻译\", \"add Chinese/English\", \"isZh\", \"tr(\", \"useT\", \"LangToggle\", \"HeaderToggles\", \"主题切换\", \"右上角\", \"en.json\", \"zh.json\", \"useTranslation\", new page, new user-facing string."
---

# i18n（core/packages/client，主工作区）

站点只服 **en + zh-Hans(简体)**。繁体(zh-Hant)2026-06-14 已彻底移除,源码禁写任何繁体字。

## 四种合法写法（按场景挑）

- **`tr({ en, zh })`** → string,`@/i18n/tr`。行内短文案首选(组件内/外都能用,读全局 `i18n.language`)。
- **`<T en={…} zh={…} />`** → ReactNode,`@/i18n/tr`。分支含 JSX(`<strong>`/`<TeX>`/链接)时用。
- **`const t = useT(); t(zh, en)`** → `@/hooks/useT`。组件内一个变量重复多段文案时省 `tr({})` 噪音。
- **`t('ns.key')`** + `i18n/en.json` & `i18n/zh.json` → 跨页复用 / `{{var}}` 插值 / 长列表。两文件 key 必须一一对应(CI `i18n-removal-guard` 守)。
- 双语数据对象 `{ en, zh }` → 直接 `tr(obj)`。

## 禁区(以后的 AI 强制遵守)

- **禁内联 UI 语言文案三元**:`isZh ? '中文' : 'English'`、`i18n.language.startsWith('zh') ? x.zh : x.en`、`i18n.language === 'zh' ? <>…</> : <>…</>` 一律改走上面四种。
  双层守卫:写入即拦 PreToolUse hook(`.claude/hooks/block-handwritten-trad.ps1` → `core/packages/client/scripts/hook-detect-traditional.mjs`)+ CI ratchet `tests/i18n-no-isz-text-ternary.test.ts`(全局语言文案三元计数只降不升;迁移后把 BASELINE 调低)。
- **禁单语裸字**(切语言会断)、**禁繁体字**(hook + `tests/i18n-removal-guard.test.ts`)。

## 唯一允许的 isZh:函数参数(util 契约)

- 非组件模块(`lib/` util / store)需要语言时,把 `isZh`(或 `lang`)当**参数**传进 —— 这是函数契约,不是内联文案三元,合法且不计入 ratchet。例:`displayCuberName(name, isZh)`。
- 但 util 若产可见文案,优先**返回 `{ en, zh }`** 让调用方 `tr()`,而不是内部 `isZh ? '中' : 'en'`。
- 组件内取语言:`const isZh = i18n.language.startsWith('zh')` 仅用于**非文案逻辑**(字号/locale code/选数据);一旦右边是文案就必须 `tr()`/`<T>`。

## 右上角切换器 / 链接

- lang + theme 一律 `<HeaderToggles className="…" />`(`@/components/HeaderToggles`,自带布局);禁手写 `<LangToggle /> <ThemeToggle />` 配 wrapper。className 只传定位。
- 站内跳转用 `@/components/AppLink`(Pattern B:en 出裸 URL、zh 补 `/zh`),禁裸 `next/link` 手拼 lang 前缀。

## 魔方术语(termbase)

- zh 魔方术语唯一权威 = `app/[lang]/wiki/glossary.json`(713 条社区中英对照)。写含魔方术语的 zh 文案先 grep 它,禁按通用语感直译。
- 高频陷阱:Overwork=复用;Corner Cutting=容错;Commutator=换位子;Conjugate=共轭子;Finger Trick=指法;Lookahead=预判;Regrip=换手;POP=飞棱;Buffer=缓冲块;Inspection=观察;OLL/PLL Skip=跳O/跳P;Scramble/Setup=打乱;Extra scrambles=备打(UI 简称);Alg=公式;Xcross=拓展十字。
- 方法名:Roux=桥式(FB=左桥,SB=右桥,Last Pair=末槽);LBL=层先法;Petrus=彼得鲁斯法;CFOP/ZZ/DR/EOLR/CMLL/LSE 留原名。zh UI 落中文名。
- 守卫:CI `tests/i18n-cubing-term-blacklist.test.ts`(已修错译黑名单,发现新错译修完即加入);豁免行内 `allow-cubing-term: <理由>`;外部作品原标题《…》自动豁免。

## 命名空间

看 `i18n/en.json` 顶层。复用优先 `common.*`(loading / back / loadFailed / unknownError / cases)。新 `t()` 键必须同时进 en.json + zh.json,`{{x}}` 两边都要有。
