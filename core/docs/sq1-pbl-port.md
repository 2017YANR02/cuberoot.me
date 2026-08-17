# Square-1 PBL 公式集与 Finder 移植跟踪

最后更新：2026-08-16

## 最终产品边界

- 主入口是 `/{lang}/alg/sq1/pbl`，由站内标准公式库的 `AlgCategoryView`、`AlgCaseView`、`CaseThumb` 和 `AlgPlayer` 接管。
- `/alg/sq1` 增加 PBL 卡片；PBL 不再作为 SQ1 工具导航中的独立“表格”页。
- JAR 的高级组合查找能力保留在 `/{lang}/alg/sq1/pbl-finder`，主公式集页提供真链接入口。
- Daniel's Public PBL Doc 只作为公式数据与维护源；网页不分发 Excel 工作簿查看器、sheet JSON、公式图片或其媒体镜像。
- 工作簿漂移仍由定时 GitHub Actions 与 `maintain-sq1-pbl` Skill 跟踪，变化须人工复核后再用新迁移上线。

## 来源与许可边界

| 来源 | 本地基线 | 用途 | 许可状态 |
|---|---|---|---|
| Daniel's Public PBL Doc | `.tmp/xlsx/Daniel's Public PBL Doc.xlsx` | 967 个非还原 PBL case 的公式、分类与维护证据 | 公开可读，但未发现明确开源或再许可条款；保留作者与来源致谢 |
| Simple Square-1 PBL Finder v1.2 | `.tmp/jar/Square-1 PBL Finder.jar` | 高级查找器的黑盒行为基线 | JAR 内没有源码、LICENSE、COPYING 或 NOTICE；未证实开源，只做 clean-room 行为重写 |

本站不分发或执行原 JAR，也不把“公开下载”表述为“开源”。Finder 复用站内 Square-1 状态机、记号、图示、播放器和 UI。

## 公式数据契约

- 工作簿 `Raw Algs` 有 968 行：1 个 `-/-` 还原参考和 967 个非还原 case；公式库只导入后 967 个。
- 967 个 case 的名称、公式和数据库 position 均唯一，公式全部通过站内 Square-1 parser、逆序 setup 与 `validateAlgCase` 契约。
- 公式库运行时唯一数据源是 PostgreSQL `alg_sets/alg_cases`；`data/sq1-pbl/cases.json` 只是可审查的维护输入与 fixture。
- 每个 case 的可执行 `AlgEntry.alg` 来自规范化 `solution`；原表的 `recommendation.algorithm` 是宏/助记文本，只进入 note，绝不交给播放器。
- 助记说明独立放在 `/{lang}/alg/sq1/pbl-notation`：103 个 Help 页定义逐项保真，31 个出现但未定义的形式明确列出且不猜解；公式集首页与 case 详情都提供真链接。
- `M/Db` 的 `Raw Algs` 公式为空，已从 `Standard Algs Data!T208` 恢复为：
  `(1, 0) / (-3, 0) / (3, 0) / (-1, 2) / (0, 3) / (-3, -3) / (4, -2) / (-1, 0)`。
- 原表刻意排除在推荐切片器外的 `Ga/Gd`、`Ga/Jb`、`Gb/Gc`、`Gb/Jb` 仍完整导入，并保留 `used:false` 来源属性。
- 两级分类为 `nP/<top>` 或 `P/<top>`，共 44 个叶分组；公式 setup 留空，由标准 SQ1 公式组件按公式逆序生成目标态。
- 初次导入使用 `0140_sq1_pbl.sql`。该迁移一旦应用即不可修改；后续表格维护必须新增编号更大的迁移，保留用户收藏、熟练度和社区数据。

## Finder 行为契约

- Top 与 Bottom 各 43 个选项，顺序固定为 21 个普通 PLL 后接 22 个 parity PLL；初始均不选择。
- 814 条默认辅助公式完整且名称、序列各自唯一；legacy 搜索枚举 `814² = 662,596` 个有序组合。
- 默认兼容原 JAR 的 legacy 语义与稳定排序；strict 是站内显式增强模式。
- legacy 中不可切的 `/` 会静默 no-op；该差异只属于 Finder，不能污染标准公式库的 SQ1 合法状态语义。
- JSON 导入、旧 localStorage、括号记号和首尾 `/` 均先规范化；取消、清空与卸载会终止 Worker 并拒绝过期消息。
- 结果方向固定为 `setup=result.setup`、`alg=result.algorithm`，复用一个 `CaseThumb` 和一个 `AlgPlayer`，并支持复制。
- Daniel 文档与 JAR 的 PLL 命名/朝向约定不同，禁止按同名 case 自动互链或用 Finder setup 翻转文档公式。

## 维护工作流

1. 在 `core/` 运行 `node packages/client/scripts/sq1-pbl-check.mjs`；退出码 0/3/2/1 分别表示同步、实质漂移、无基线和解析失败。
2. 有漂移时逐项审查工作簿语义、968 行完整性、967 个可执行公式、963 个推荐 case、4 个 unused case 和 `M/Db` 恢复证据。
3. 审核通过后运行 `node packages/client/scripts/sq1-pbl-check.mjs --write`，只同步 `cases.json`、Finder 默认值和漂移基线。
4. 运行公式生成器的 `--check`、Python 规范化测试、漂移测试、公式库测试和 Finder golden 测试。
5. 若公式内容变化，新建下一号 PG 迁移并在本地 PostgreSQL、API、桌面与窄屏页面完整验证；禁止重写 `0140_sq1_pbl.sql`。

定时工作流 `.github/workflows/sq1_pbl_drift.yml` 只创建或更新一个带 `sq1-pbl-drift` 标签的开放 Issue，不自动上线上游变化。

## 审查轮次

| 轮次 | 范围 | 结论或证据 |
|---|---|---|
| 1 | 来源、许可与边界 | JAR 内无许可证和源码，公开检索未找到可核实开源仓库；按未核实许可登记 credits |
| 2 | 工作簿完整性 | 64 sheets、968 Raw Algs 行、963 recommended、4 unused、频次总和 10,368；threaded comments 作为 editorial 噪声 |
| 3 | 数据恢复与规范化 | `M/Db` 只允许从指定标准公式格恢复；任何其他非还原空公式 fail closed |
| 4 | 标准公式库映射 | 967/967 case、44 叶分组、唯一名称/公式/position、parser 与 inverse 闭环全量断言 |
| 5 | JAR 黑盒兼容 | 21+22 选项、814 默认辅助公式、`Ua/Ua` 125 条完整结果和顺序、非法切层 no-op 均由 golden fixture 锁定 |
| 6 | 路由与复用 | PBL 卡片进入 `/alg/sq1`；主路由由标准动态公式页接管；Finder 独立；旧 Excel Workspace 与公开资产退出 |
| 7 | 维护与发布安全 | 漂移 Issue、Skill、确定性快照和不可变迁移规则分层；本地 PG/API、类型检查、桌面与 `<480px` 验收作为提交门槛 |
| 8 | 助记记号保真 | 独立说明页锁定 103 个定义、31 个未定义形式、4 条替代展开式与原表注释；助记只作 note，永不进入 parser/player |

## 当前验收清单

- [x] 公式集迁移生成器对 967 个 case fail closed，并与 `0140_sq1_pbl.sql` 完全一致。
- [x] 本地 PostgreSQL 应用迁移后得到 967 行、967 个唯一名称、967 个非空公式、44 个叶分组。
- [x] 本地 API `/v1/alg/sets/sq1/pbl` 返回完整 967 个 case；`M/Db` 与四个 unused 属性对账。
- [x] 公式库定向测试逐条验证 parser、setup/alg 闭环、标准播放器校验和助记文本隔离。
- [x] PBL 已加入 SQ1 公式库 catalog，旧精确 PBL 页面退出，新增 Finder metadata 与真链接。
- [x] Finder 核心 52 条测试覆盖完整 `Ua/Ua` 输出、legacy 边界、输入规范化和 Worker 生命周期。
- [x] `--public-write`、sheet/media/formula-media 网页导出路径退役；维护命令只更新公式源、Finder 默认值和基线。
- [x] client/server typecheck、10 个定向测试文件共 95 项测试、Skill 校验和最终 `git diff --check`。
- [x] 桌面与 390px 临时视口（页面可用宽 312px）浏览器验证：PBL 卡片、44 分组、`M/Db` 图示/动画、Finder 入口均可用，公式库、22-case 分组页、case 页和 Finder 均无整页横向溢出。
- [x] 桌面与 390px 窄屏验证助记说明页、公式集入口、case 详情入口和 103 项表格；回归测试锁定来源定义与未定义边界。

## 交付规则

- 只提交本任务路径，不覆盖并行工作；删除旧查看器及资产走回收站。
- 默认 commit 但不 push。未 push 前不得声称线上页面已更新。
