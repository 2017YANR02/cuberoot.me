# 下载页对标与本地优化（2026-10-30）

本轮检查官方在线页面的内容与入口结构；额外在浏览器查看 Obsidian、VS Code 的实际布局与 DOM。没有将网页可见结构当作对方的源代码或技术栈证据。

| 官网 | 当前页面的安排 | 本页采用的做法 |
| --- | --- | --- |
| [Microsoft VS Code](https://code.visualstudio.com/download) | 平台分组，主下载按钮旁列系统要求，其他构建单独选择 | 平台并列，主次下载分层，要求紧邻按钮 |
| [Mozilla Firefox](https://www.mozilla.org/en-US/firefox/all/desktop-release/) | 平台、架构、语言分步选择，另有安装格式解释 | 仅展示实际支持的架构，不让用户面对无效选项 |
| [Notion](https://www.notion.com/desktop) | 简短价值说明、直接下载、兼容要求链接和移动端入口 | 合并重复标题，只保留一句产品说明 |
| [Obsidian](https://obsidian.md/download) | 当前平台主下载；完整平台列表中 Android 同列 Play 与 APK | 保留商店和直接 APK 两条入口，官网版本明确归属 APK |
| [Signal](https://signal.org/download/) | 手机、桌面分组，安装前提紧邻对应平台 | 必要限制就地说明，详细内容按需展开 |
| [Figma](https://www.figma.com/downloads/) | 桌面、移动、其他分组，链接直接命名平台和架构 | 明确下载对象，未发布平台集中收纳 |
| [Google Chrome](https://www.google.com/chrome/) | 产品价值介绍，移动下载另设入口，另列平台兼容信息 | 下载页保留简短价值说明；不引入大段营销内容 |

VLC 官方页面抓取返回 418，未将其作为已核实依据。

## 实现取舍

- 两个已发布平台采用桌面双栏、640px 以下单栏。不增加自动平台推断；全部可用下载始终可见，也不会在尚无安装包的 macOS 上误推下载。
- 主入口为 Google Play 和 Windows 安装版；APK、免安装 EXE 为次级链接。官方 Play 图保持原图、比例与自带留白。
- 标题合并为“下载 CubeRoot”，产品介绍一句话。Android 官网版本号不冒充 Play 版本。
- 换渠道更新限制、Windows 未签名信息保持可见，签名差异、构建号与 WebView2 前提放在原生 details/summary 中。
- iOS、macOS、HarmonyOS NEXT 合并一行“暂未发布”，不承诺发布日期。
- 复用 BackHome、Tooltip、AppLink、共享 release parser 和原下载统计；管理员入口仍为右上角图标。CSS Grid 负责响应式，不按浏览器宽度复制组件。
- Windows 网络错误与加载状态分开，失败可重试，避免把获取失败描述成尚未发布。

## 验证与范围

Client typecheck 与 diff whitespace 检查通过；浏览器检查中文桌面、390px 手机宽度、英文说明展开，以及 system/light、system/dark、light/dark、dark/light 四种主题组合；窄屏未出现页面横向溢出。没有执行安装包下载或应用安装验收。

本次交付包含下载页两个文件、本记录及 AGENTS.md 的展开/收起图标约束；使用线性 Chevron 图标替换原生三角标记，并验证展开与收起两种状态。仅本地提交，未推送、未部署；其他任务的修改不纳入本次提交。
