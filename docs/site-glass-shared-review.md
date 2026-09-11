# 全站玻璃共享表面实施与审核记录

扫描与验证日期：2026-09-10。此记录只覆盖下列共享 CSS 和实际观察到的页面状态，不替代 [全量路由清单](site-glass-route-audit.md) 的逐页视觉验收。未暂存、未提交。

## 实施边界

- `core/packages/client/components/site-surfaces.css`：显式列举现有卡片、面板、共享菜单和弹窗；统一使用全局玻璃变量；浮层使用 `--glass-popover-bg` 提高文字覆盖内容时的可读性。包含 `.appearance-menu`、`.lang-menu`、CompactSelect 触发器及 portal。
- 原生 select、textarea 和文本/数字/日期类 input 的关闭态使用玻璃填充，保留尺寸、边框语义和控件图标；排除 checkbox、radio、range、color、file、hidden 等非文本输入。原生 option/optgroup 使用主题实底，系统弹层无法采样网页背景。
- 不使用 class 子串匹配，不改定位、overflow 或伪元素，不对表格每个单元格增加 blur。已有选中、主要操作、警告和图表系列色保留。
- `core/packages/client/components/platform/platform.css`：平台根容器透景，现有 `.platform-glass` 消费全站变量，移除卡片方向性高光及导航/根容器装饰渐变；照片文字覆盖层使用共享 popover 浓度。
- `core/packages/client/components/distribution-viz/viz.css`：内嵌选手分布图根容器透景；图表外壳、统计栏、工具栏及浮层统一材质。保留实际 canvas 绘图、系列语义色与 light/dark ink RGB 契约。

## 实测证据

| 页面与状态 | 实际观察 | 判定边界 |
| --- | --- | --- |
| `/zh/platform` 桌面 1280px | 根容器透明；导航和教师信息卡 computed 为主题表面 22% + `blur(10px)`；内容宽 1265px，无横向溢出；截图 `.tmp/png/site-glass-platform-desktop.png` 已查看 | 公开落地页首屏实际检查；不代表所有平台 registry 项 |
| `/zh/platform` 移动端 390px | 内容宽 375px；导航 left 14px、right 361px，无横向溢出；滚动后截图 `.tmp/png/site-glass-platform-mobile.png` 已查看 | 教师照片上的次要文字在 22% 表面上对比度不足，已改共享 popover 浓度；修改后的照片视觉效果待主 Agent 复查 |
| `/zh/platform` 明暗组合 | 临时 DOM theme + Playwright colorScheme 检查 system/light、system/dark、light/dark、dark/light 四格；浅色文字 rgb(23)、深色文字 rgb(237)，表面分别白色/深色 22%，均 blur 10px，无横向溢出 | 属性和系统模式测试后恢复；未写用户存储；未逐项切换六种配色 |
| `/zh` 移动端 390px | 真实 `select.rs-select` 的标准、XCross、9 步均 computed 深色主题表面 22% + `blur(10px)`；控件都在视口内 | 用户指出的三个原生关闭态已实证；不代表系统 option 弹层可玻璃化 |
| `/zh` 外观菜单移动端 | 新选择器落盘后，旧 tab 仍读取原有实底 CSS；截图 `.tmp/png/site-glass-appearance-mobile.png`；尝试 reload 等待 domcontentloaded 超时 30 秒 | **未通过**：不能以源码存在代替更新后的 computed 与截图；由主 Agent 接管串行浏览器复查 |
| 内嵌选手分布图 | 全文件静态审查与显式 CSS 适配 | 未打开真实有成绩选手的数据视图，不标视觉通过 |

## 尚未覆盖的状态

- 平台 103 个 registry 项的静态归属见全量清单；本次仅实际浏览公开平台落地页。账号、讲师、管理员页面不能用登录提示壳代替业务状态验收，未执行任何登录或写操作。
- canonical 项转向主站实际 UI，需要到目标页面验收；不能以 Platform 共用外壳替代。
- 动态详情需要真实有效 ID；404、空数据或加载态不能标记业务通过。
- 上游 iframe 内部、外部独立站点和原生系统菜单不在本次 CSS 控制范围。保留画布、媒体、图表图例和棋盘/魔方语义色。
- 未验证六种主题配色全组合、reduced-transparency、禁用 backdrop-filter、长表格滚动及弹窗全部交互。共享引擎的相关验证由主方案统一记录。

## 验证与环境

本次修改均为 CSS / Markdown，依仓库规则不运行 TypeScript 检查。三个 CSS 已通过 PostCSS.parse：共享表面 4236 bytes / 150 行、平台 42228 bytes / 1620 行、分布图 21834 bytes / 918 行，三者均无 CR。范围内 `git diff --check` 已通过一次。浏览器为 Playwright MCP；未关闭其他标签页。由于 MCP 页面可能共享，按主 Agent 指示停止后续浏览操作，由主 Agent 串行接管。
