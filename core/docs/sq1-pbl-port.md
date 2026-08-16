# Square-1 PBL 文档与 Finder 移植跟踪

最后更新：2026-08-16

## 目标与边界

- 主入口：`/[lang]/alg/sq1/pbl`，并从现有 `/alg/sq1` 与 SQ1 工具导航进入。
- 文档源：Daniel's Public PBL Doc Google Sheet；完整保留用户内容、公式、案例、说明、链接和有语义的视觉分组，忽略表格调试痕迹与无语义元数据。
- Finder 源：`Square-1 PBL Finder.jar`；以行为兼容方式在站内重写，不在浏览器分发或执行 JAR。
- SQ1 记号、状态、形状名、图示和链接必须复用站内共享实现，不另造解析器、播放器或第二套形状数据。
- 中英文 UI 走站内 i18n；来源文档正文保留作者原文，并明确标注来源与更新时间。
- 上游表格发生实质变化时，GitHub Actions 创建或更新单一漂移 Issue；不自动把未经校验的数据上线。

## 来源基线

| 来源 | 本地基线 | SHA-256 | 许可状态 |
|---|---|---|---|
| Square-1 PBL Finder | `.tmp/jar/Square-1 PBL Finder.jar` | `dec27e3b9879a64b39168a4152c6d39b78af41cd68d8abb41be5a96d3b032d11` | 未发现源码或许可证，不能称为开源；仅作 clean-room 行为重写并保留来源致谢 |
| Daniel's Public PBL Doc | `.tmp/xlsx/Daniel's Public PBL Doc.xlsx` | `1549ed904a32cf5160b3646b79a3d65d1891354c0fe3164ce0472f4065ec67c6` | 公开可读，未发现明确再许可文本；保留原作者、来源链接和内容层归属 |

### Finder 基线清单

- Java 8 JAR，74,717 bytes，22 个 class；没有源码、LICENSE、COPYING、NOTICE 或其他资源文件。
- 作者署名为 Anuar Onofre 和 Lucas Sousa；About 说明思路来自 Jayden McNeill，多数辅助公式来自 Charlie Stark 的 Sub 6 PBL list。
- 43 个上下层选项，其中 21 个普通 PLL、22 个 parity PLL；GUI 搜索空间是完整的 `43 × 43 = 1,849` 种组合。
- 默认辅助公式 814 条，规范化后名称和序列各自均唯一；原程序枚举 `814² = 662,596` 个有序二元组。
- 结果先保留生成顺序，再按 `/` 数量稳定升序；原程序不校验中层状态，网页同时保留 legacy 兼容夹具和 strict 修正版口径。
- 原程序在当前形状不可切时会静默忽略 `/`；该历史行为解释了 `U+/U-7` 接 `Rb/L5` 至 `Rb/L16` 的 12 条结果，只保留在 legacy Finder，strict 模式继续使用站内合法切层语义。
- `Ua/Ua` 完整默认表的 legacy 基线是 125 个结果，前 3 条结果另存为 golden fixture。

### 工作簿基线清单

- 64 个 sheet：63 个可见，隐藏 `wtfP` 1 个；表内记录 143,902 个单元格。
- 33,763 个单元格有字面值或缓存值，8,061 个公式单元格；内容并集 37,835，纯样式单元格 106,067。
- 321 个合并区域、10 个数据校验、17 条条件格式、657 个链接、793 条公开稳定批注。
- 13 张唯一 PNG、15 个图片锚点、3 个 table；所有内容和媒体均纳入规范化清单。
- 公式类型为 shared 5,916、normal 2,115、array 30；4,072 个公式缓存为空。shared 公式保留 master/range，5,768 个从属格只标记 master 模板，不伪造平移后的公式。
- 空缓存公式中 3,089 格是原表可见图片：3,082 个直接 IMAGE 和 7 个动态选择结果；已物化为 1,116 个 content-hash 静态资产（1,102 PNG、14 SVG，共 24,694,158 bytes），其余 983 格是原表空值守卫。
- `Raw Algs` 共 968 个状态：solved 1 个、非 solved 967 个，frequency 合计 10,368。
- 推荐表公开 963 个状态；`Ga/Gd`、`Ga/Jb`、`Gb/Gc`、`Gb/Jb` 4 个 double-misalign 状态刻意标为 unused，迁移时保留并写成 `used:false`。
- 本地文件比线上公开 export 多 376 条 Google threaded-comment 的 Excel 降级副本；它们归入 editorial 噪声，不参与内容漂移哈希。

## 工作流

1. 反编译并黑盒核对 Finder 的默认数据、输入边界、搜索语义、排序和输出格式。
2. 枚举工作簿全部工作表、范围、公式、图片、链接、批注、隐藏内容和格式语义，建立完整性清单。
3. 把上游内容规范化为可审查的仓库快照；生成页面数据时保持确定性。
4. 在共享 SQ1 组件之上实现文档浏览和 Finder，覆盖桌面与 `<480px`。
5. 建立定时漂移检测、去重 Issue 和项目 Skill；维护时先对比、再校验、后更新基线。
6. 完成数据、算法、UI、移动端、可访问性、i18n、许可和回归测试多轮审查。

## 功能清单

### PBL Finder

- [x] Top PLL 与 Bottom PLL 各有 43 项，按 21 个普通 PLL 后接 22 个 parity PLL；初始均不选择，与 JAR 一致。
- [x] Auxiliary Algorithms 默认表完整，支持新增、删除、JSON 导入导出和输入校验；导入与持久化数据统一规范为 Finder compact 记号并保留首尾 `/`。
- [x] Finder 默认使用 legacy 搜索语义和稳定排序；strict 作为显式增强项额外校验中层并规范化、去重输出。
- [x] 空选择、非法公式、重复名称、无解、括号记号、首尾 `/`、上下层对称与奇偶边界有明确处理。
- [x] 选中结果公式可复制，并复用单个 `AlgPlayer` 动画与 `CaseThumb` 主图。

### PBL 文档

- [x] 64 个工作表（含 hidden 标识）均由清单选择并按需载入完整单元格数据。
- [x] 公式、案例名、注释、图示、链接、作者说明及共享公式模板已完整保留并完成计数对账。
- [x] 合并、样式范围、行列尺寸与隐藏、冻结窗格、链接和图片锚点均进入响应式工作表视图。
- [x] 数字格式覆盖百分比、日期、整数与定点小数；富文本逐 run 保留颜色、粗斜体和删除线；现有条件格式实际应用色阶及 differential fill/font。
- [x] 空缓存 IMAGE/派生公式通过严格 `computedImage` 契约显示本地 content-hash 图片，公式文本仍可查看；图片带可访问名称、尺寸、懒加载且受单元格宽度约束。
- [x] 原文、站内双语辅助文案和来源信息职责分离。
- [x] 宽表使用局部横向滚动；桌面、平板和 `<480px` 的布局规则已实现，实机浏览器验收留在第 7 轮。

### 上游维护

- [x] 统一抓取层可下载 Google Sheet 当前公开导出。
- [x] 规范化快照忽略无语义元数据，保留内容、公式、链接和结构变化。
- [x] 检测器退出码区分一致、漂移、无基线和抓取/解析失败。
- [x] GitHub Actions 定时检查，漂移时创建或更新单一标签 Issue。
- [x] `.agents/skills/maintain-sq1-pbl` 覆盖 PBL 上下文中的“维护表格”等触发词和完整更新流程。

## 审查轮次

| 轮次 | 范围 | 状态 | 证据 |
|---|---|---|---|
| 1 | 来源、许可与版权边界 | 完成 | JAR 无许可证文件，公开检索未找到源码或许可证；credits 按未核实许可登记 |
| 2 | JAR 行为与算法等价性 | 完成（独立验证） | `export-finder-jar.mjs --check` 已验证 21+22 PLL、814 unique auxiliary、Ua/Ua=125；独立反汇编定位并复现不可切 `/` 静默跳过语义。52 项测试锁定精确选项顺序、42 个 legacy optimizer 行为、不可切 `/` 定向回归、括号与边界 `/` 导入、完整 125 条 Ua/Ua 结果及顺序，以及 Worker 启动失败和 stale message 守卫 |
| 3 | XLSX 内容与结构完整性 | 完成 | 64 sheets、37,835 content cells、8,061 formulas、657 links、793 stable notes、13 workbook PNG；另锁 3,089 个公式图片格、1,116 个本地公式资产及 shared/normal/array/empty-cache 全量计数 |
| 4 | 数据模型与站内复用边界 | 完成 | 路由定为 `/alg/sq1/pbl`；CaseThumb、单个 AlgPlayer、SQ1 shared parser/state、按需快照为唯一实现边界 |
| 5 | 页面、移动端与可访问性 | 完成（代码与契约） | 64 表按需浏览、完整单元格细节、数字格式、逐 run 富文本、17 条条件格式、冻结/隐藏、含 fragment 的真链接、公式计算图片、复制反馈及窄屏局部滚动已实现；浏览器实测因本地 dev 无法启动单列在第 7 轮 |
| 6 | 漂移检测与 Skill 前向测试 | 完成 | CLI 0/1/2/3 真运行；Skill validator 通过；workflow 3 段 shell 均通过 `bash -n`，Issue 按标签只取首个 open 项并在 comment/create 间二选一 |
| 7 | 测试、typecheck 与浏览器验收 | 部分完成 | 隔离完整工作树中 Finder、数据、漂移和 loader 共 4 files/75 tests 通过，client typecheck 通过；Python 3 tests、JAR exporter、Skill validator、esbuild、metadata/URL/catalog 守卫均已执行。隔离 Next dev 已编译目标路由，页面、manifest、sheet JSON 和公式 SVG 均返回 200；当前浏览器控制会话不可用，未把 HTTP 取证冒充桌面与窄屏视觉验收 |

## 验证清单

- [x] JAR 固定输入夹具与站内 Finder 输出已写入逐条断言；替代配置直接载入 HEAD 共享 SQ1 模块后，Finder 52 tests 全部通过，含不可切 `/` 定向回归、`814²` 候选与 125 条结果逐条顺序对照；最终 exporter `--check` 再次通过。
- [x] 上游工作簿完整性计数由测试锁定，不以抽样代替全量核对。
- [x] 同一 XLSX 连续两次 public export 逐文件 SHA-256 完全一致：public 1,195 files 加 `cases.json`，before=1,196、after=1,196、changed=0；第二次从本地 content-hash 缓存完成。
- [x] 漂移检测器在未变化、人工变化、缺基线和抓取失败四种情况下分别返回 0、3、2、1。
- [x] 页面 metadata（6 tests）、URL state（2 tests）与组件复用守卫（13 tests）通过；i18n 和 catalog 测试在收集期分别因并行缺失 `opencc-js`、`lucide-react` 被阻断，未误记为通过。
- [x] Workspace 与数据 loader 的 esbuild、完整 computedImage 正反契约、目标文件 whitespace 检查、隔离完整工作树中的 4 files/75 tests 与 client typecheck 均通过。
- [ ] Playwright 实测桌面与 390px：无整页横向溢出，关键交互可键盘和触摸完成。

### 维护链验证记录（2026-08-16）

- 完整生成：`node packages/client/scripts/sq1-pbl-check.mjs --write`。
- 公式图片首次生成：`node packages/client/scripts/sq1-pbl-check.mjs --source "..\.tmp\xlsx\Daniel's Public PBL Doc.xlsx" --public-write`；64 sheets、3,089 computedImage cells、1,116 assets、24,694,158 bytes。
- 公式图片安全契约：`uv run python packages/client/scripts/sq1-pbl/test_normalize.py`；真实 get_image3 SVG 接受，script/foreignObject/外链 href 拒绝，stale 常规文件只移动到 `.tmp/sq1-pbl-stale/`，3 tests 通过。
- 无漂移 0：`node packages/client/scripts/sq1-pbl-check.mjs --source "..\.tmp\xlsx\Daniel's Public PBL Doc.xlsx"`；仅 editorial 差异，退出 0。
- 抓取失败 1：`node packages/client/scripts/sq1-pbl-check.mjs --source "..\.tmp\scratchpad\sq1-pbl-does-not-exist.xlsx"`；退出 1。
- 无基线 2：`node packages/client/scripts/sq1-pbl-check.mjs --source "..\.tmp\xlsx\Daniel's Public PBL Doc.xlsx" --baseline "..\.tmp\scratchpad\sq1-pbl-missing-baseline.json"`；退出 2。
- 实质漂移 3：`node packages/client/scripts/sq1-pbl-check.mjs --source "..\.tmp\xlsx\Daniel's Public PBL Doc.xlsx" --baseline "packages\client\scripts\sq1-pbl\material.snapshot.fixture.json"`；最小 schema v1 空基线触发内容、表页和不变量漂移，退出 3。
- Skill：`$env:PYTHONUTF8='1'; uv run --with pyyaml python "C:\Users\CubeRoot\.codex\skills\.system\skill-creator\scripts\quick_validate.py" ".agents\skills\maintain-sq1-pbl"`；`Skill is valid!`。
- 数据测试：在 `core/packages/client` 运行 `pnpm dlx vitest@4.0.17 run tests/sq1_pbl_public_export.test.ts tests/sq1_pbl_drift.test.ts tests/sq1_pbl_data.test.ts`；3 files、19 tests 全部通过。
- Finder 全量回归：使用 `.tmp/scratchpad/sq1-pbl-vitest.config.mjs` 将缺失的 workspace shared 包显式映射到 HEAD 源文件，运行 `pnpm dlx vitest@3.2.4 run packages/client/tests/sq1_pbl_finder.test.ts`；1 file、52 tests 全部通过，含不可切 `/` 定向回归，Ua/Ua 662,596 个有序候选与 JAR 的 125 条结果逐条一致。
- public export 定向复验：共享 workspace 暂缺包链接时直接使用现有 Vitest 4.1.10 和 `.tmp/sq1-vitest.config.mjs` 运行 `tests/sq1_pbl_public_export.test.ts`；1 file、7 tests 全部通过。

## 交付状态

- 本文档是逐项验收清单；任何相似功能、抽样通过或静态代码存在都不能替代对应勾选项的直接证据。
- 默认只提交本任务文件，不 push；线上状态只有在用户后续明确授权 push 后才能声称。
