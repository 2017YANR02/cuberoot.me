# 多语言与 WCA 翻译

本文件承接根 [AGENTS.md](../../AGENTS.md) 中的对应细则（2026-11-05 整理），是当前维护规则，不是历史归档。涉及本主题时先读；当次用户指令优先。代码路径除明确标注外均相对仓库根目录，core 命令在 `core/` 执行。发布授权统一见[发布规则](release.md)。

## i18n(繁体已移除)

- 全站只 en + zh-Hans。守卫:hook `block-handwritten-trad` + CI `i18n-removal-guard`(含 en/zh key 对齐)。
- 文案走 `tr({en,zh})` / `<T en zh/>` / `useT()`;长文/复用走 `t()` + `en.json`/`zh.json`;HTML lang `en`/`zh-Hans`。
- 禁内联 `isZh`/`i18n.language` 文案三元(`isZh ? '中' : 'EN'`);`isZh` 仅可作 util 参数。守卫:hook + CI ratchet。细则调 skill `i18n`。
- 一般社区魔方术语 zh 查 `client/app/[lang]/wiki/glossary.json`，WCA 专名与规则语境按下条官方来源核对，禁凭语感直译；陷阱表+黑名单守卫见 skill `i18n`。
- 翻译 WCA 规则、公告或意外事件记录前，先读 [WCA 英中翻译参考](../../core/packages/client/public/regulation/wca-translation-reference.md)，再按条款号查同目录 `wca-regulations-bilingual.md`；机构、菜单和页面用语直接查 WCA Weblate 简体中文项目（如 WIC = 廉政委员会）。网页入口 `/regulation/translation`。保留版本、主体、义务强弱和处罚范围，历史 WDC/WAC 不替换成当前机构或缩写，原译疑点单列，不把对齐语料视为已逐句审核。一般社区术语仍查词典。
- **`/regulation` 正文链接优先站内**：新增或同步规则、公告、日志和引用资料前，读取[引用阅读页与站内链接维护说明](../../docs/wca-reference-translations/README.md)，复用 `regulation-links.ts` 与 `RegulationLink` / `RegulationHtml`；保留源记录的原始 URL，由统一解析器映射，禁止逐篇硬改生成 JSON 或另建映射副本。官方来源、邮箱及无对应内容的引用保留原用途，历史版本不得误映射到现行规则；未取得正文不创建空阅读页，摘要不得冒充全文译文。
- WCA 官网翻译以 [Weblate 简体中文项目](https://translate.worldcubeassociation.org/projects/wca/-/zh_Hans/)为主要来源，规则含义仍以适用版本英文为准。AI 优先查 `https://api.cuberoot.me/v1/wca/translations?q=<URL编码查询>&limit=5&v=1`，核对 ready/stale 和来源；未命中或服务不可用再查 Weblate，最后使用同提交的官方 GitHub locale 文件后备。不手改服务器镜像，不自造官方译名。具体检索步骤和权限边界在上述 MD 与 `i18n` skill 中维护。
- 教程项目选择器的 ivy 中文短名固定为「枫叶」,禁加通用品类后缀。
- 站内违禁词表 `.codex/banned-words.json`(hook `block-banned-words` 写入即拦,`.codex/` 自身豁免);用户说「添加违禁词:x」= 往该表加 `{word,use,why}` 一条。行内豁免注释 `allow-banned-word`。
