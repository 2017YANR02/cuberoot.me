# Squanmate → CubeRoot SQ1 移植跟踪

最后更新：2026-08-15

## 目标与边界

- 上游网站：[`squanmate.cuber.pro`](https://squanmate.cuber.pro/)。
- 上游源码：[`mikavilpas/squanmate`](https://github.com/mikavilpas/squanmate)，本地基线提交 `6370c09bba724e8c382723347b571c9656d76a14`，EPL-1.0。
- CubeRoot 主入口：`/[lang]/alg/sq1`；功能页放在 `/{lang}/alg/sq1/*`，单层命名页保留为 `/{lang}/sq1/cs/name`。
- 不移植 ClojureScript、Reagent、Bootstrap、Quil 画布和 Google Analytics。
- SQ1 记号与状态只用 `@cuberoot/shared/sq1-notation`；静态图只用 `lib/sq1-svg.ts`；公式与训练进度只用现有 `/alg/sq1/*`；绘图只用 `/sim?puzzle=sq1&img_r=y-30x-60&img_dist=6&tool=draw`。
- 页面中不再另造 SQ1 状态机、绘图器、算法播放器或颜色设置；公式训练数据由上游五个 algset 源文件生成静态快照，并继续用站内共享 SQ1 parser/state 执行。

## 功能总表

状态：`完成` 表示已经有可用的 CubeRoot 等价功能；`进行中` 表示入口或主体已落地但仍缺上游细项；`待做` 表示尚未提供用户入口。

| Squanmate 功能 | CubeRoot 路由 / 复用点 | 状态 | 验收细项 |
|---|---|---|---|
| Cubeshape trainer | `/alg/sq1/train` | 完成 | 90 个无序合法组合等概率抽题；共享 csTimer `sqrcsp` 引擎为每题生成随机块排列、层转和新打乱；具备范围、排除、同/反 parity、交换、观察、中层策略、快捷键和持久化 |
| Algorithm trainer | `/alg/sq1/algorithm-trainer` | 完成 | 上游五组 `2 / 99 / 43 / 16 / 72 = 232` 个 parity-aware 情况完整快照；支持 odd/even 批量选择、新打乱、重复情况、检查打乱、答案显示、Space 快捷键、选择持久化与中层策略 |
| All shapes | `/sq1/cs/name` | 完成 | 29 种单层形状、Squanmate 顺序和名称、L/R 缩写、站内 `CaseThumb` |
| Shape recognition training | `/sq1/cs/name/train` | 完成 | 从介绍页进入训练；29 种形状；每题固定 6 个候选且必含正确项；作答前读屏文本不泄题；直达页标题、加载/重试、进度语义完整 |
| Scramble inspector | `/alg/sq1/inspect` | 完成 | 输入与链接保留、严格记号和切层合法性、最终上下层形状与中层状态；上下层 + / − 跳到最近可切位置；不可切时阻断结论，可切后显示上游六项奇偶计数组成 |
| Algorithm shape visualizer | `/alg/sq1/visualize` | 完成 | 起始设置、逐步形状图、分享 URL；共享 parser/state/SVG |
| Cubeshape algorithm importer | `/alg/sq1/import` | 完成 | 同时从对齐复形和 `(1,-1)` 错位复形反推起始设置与上下层形状；上游 `/-2/-3/` fixture 得到 Mushroom / Square；拒绝非法输入并可打开过程页 |
| Parity count positions | `/alg/sq1/count` | 完成 | 29 种层形、形状图与径向数位、全部合法可切位置；旋转后图形、当前数位和两组相对位置一起更新 |
| Parity game | `/alg/sq1/parity-game` | 完成 | O/B/R/G 三色序列、奇偶作答、答对换题、左右方向键、连续正确数 |
| Settings | 训练页本地设置 + `/sim` | 完成 | 形状范围、排除组合、观察和中层策略已持久化；公式训练的情况范围和中层策略已持久化；颜色与绘图复用 `/sim` |
| SQ1 drawing | `/sim?puzzle=sq1&img_r=y-30x-60&img_dist=6&tool=draw` | 完成 | 29 预设名称统一到形状单一数据源；继续使用既有绘图交互与导出 |
| Shareable links | inspector / visualizer / importer 查询参数 | 完成 | 站内 `nuqs`，刷新/前进/后退可恢复，不写裸 history |
| Keyboard cheat sheet | 各训练页 | 完成 | 组合练习和奇偶游戏就地列出实际快捷键；公式训练显示 `Space` 新打乱，输入与按钮聚焦时不抢按键 |

## 上游训练器明细

### 组合练习

- [x] CS/CSP 题库覆盖的 90 个无序形状组合等概率抽取，不受同组 DB 行数影响。
- [x] `Space` 新题；`Shift+Space` 排除当前无序组合并新题。
- [x] `R R` 重复组合并随机 parity；`R S` 同 parity；`R O` 反 parity；`R F` 互换上下层。
- [x] 可从已选组合随机抽题，并通过可见按钮重复组合、同/反 parity 或交换上下层；不可用动作直接禁用。
- [x] 每次 Repeat 都为同一组合重新生成随机块排列、合法层转与新打乱，不复用数据库固定 setup。
- [x] 中层翻转：随机、总是、从不。
- [x] 可选 15 秒观察倒计时；倒计时期间保留形状图并隐藏名称和打乱答案。
- [x] 选择和设置写本地存储；非法选择禁用出题；上层、下层或排除导致空范围时提供对应恢复动作和一键恢复全部范围。

### 公式训练

- [x] 专用入口 `/alg/sq1/algorithm-trainer` 覆盖 Cubeshape、EP、PLL、Lin CP、Lin PLL+1 五组，精确计数为 `2 / 99 / 43 / 16 / 72 = 232`。
- [x] 题库从本地 Squanmate 基线的五个 Clojure algset 文件生成 `lib/sq1-alg-trainer-data.ts` 静态快照，不在运行时依赖上游，也不凭名称硬合并站内 DB。
- [x] 能按 odd/even parity 批量选择，也能逐情况选择；选择数和中层策略写入本地存储。
- [x] `Space` 新打乱；可重复当前情况、显示答案并把当前打乱送到 inspector。
- [x] 中层策略支持随机、总是翻转、从不翻转；两种强制状态保持相同外层块排列。
- [x] 上游 `M2`、`U / U' / U2`、`D / D' / D2`、`*` 和单层转记号先归一化，再由共享 SQ1 parser/state 校验；232 个情况的逆 setup 全部通过合法性回归测试。

## 29 种形状命名单一源

- [x] `@cuberoot/shared/sq1-shapes` 保存上游 key、原名、本站 L/R 名、上游 pattern 和既有绘图 preset ID；客户端 `lib/sq1-shapes.ts` 只补状态识别，不复制命名表。
- [x] 公式库/介绍/识别训练通过 `displaySq1ShapeName()` 与 `SQ1_SHAPE_NAMES` 共用名称。
- [x] `/sim` 绘图预设从同一表生成，不再显示 `R Paw`、`Twins`、`71`、`51R`、`L`、`I` 等旧标签。
- [x] 打乱检查、可视化、导入、数位和组合练习全部只引用此表。
- [x] 回归测试锁住 29 个名称、顺序、pattern 的循环匹配和 solved = Square。

## 170 个 Cube Shape case 对齐

- [x] `sq1/cs` 的 170 个有向情况与 Squanmate 名称逐条一一对应，组成 90 个无序组合；数据库保存完整原名，展示层才把 Left / Right 缩为 L / R。
- [x] 每个 case 的 setup 与全部公式逆状态都识别为名称标注的同一组上下层形状；首公式实际刀数与 subgroup 一致。
- [x] 数据迁移先核对 170 条旧名称、分组、setup 与公式快照，发现任何漂移就整批中止；更新后再次核对 170 个不重复名称。
- [x] 历史 paw / Pair / Muffin / Edges 大小写别名以及 6 个错误刀数分组，会一次性迁移本地与云端训练记录、标记、SRS、连拧顺序、协同房间、主公式偏好和社区投稿。
- [x] 公式库数据请求带版本参数，避免部署后的新代码误读一小时旧缓存；截图所示 R pawn / L pawn 与 L pawn / R pawn 两条有独立回归。

## 复用清单

| 能力 | 必须复用 |
|---|---|
| 站内公式库 | `loadAlg('sq1', set)`、`AlgCaseView`、现有 `/select` 与 `/run` |
| Squanmate 公式训练快照 | `lib/sq1-alg-trainer-data.ts`（生成器：`scripts/generate-sq1-alg-trainer-data.mjs`） |
| SQ1 解析/逆公式/状态 | `parseSq1Tokens()`、`invertSq1Alg()`、`applySq1Scramble()` |
| 静态状态图 | `renderSq1Svg()` / `CaseThumb` |
| 动画与手动转动 | `/sim?puzzle=sq1` |
| 绘图 | `Sq1DrawPanel`，从 `/sim?...&tool=draw` 进入 |
| URL 状态 | `nuqs` |
| 双语 | `tr({ zh, en })` / `useT()` |
| 内部跳转 | `AppLink`，离开当前高基数页时 `prefetch={false}` |

## 验证清单

- [x] 上游九个页面逐项对照；功能总表没有未解释的空项。
- [x] 29 种形状名称、顺序和左右方向与 Squanmate `#/shapes` 一致，本站仅把 Left/Right 缩为 L/R。
- [x] 170 个 Cube Shape case 的名称、setup、全部公式状态与刀数分组全量一致；不是只抽查卡片名称。
- [x] 所有输入的 SQ1 算法都经共享 parser/state 执行；非法输入有明确提示，不渲染垃圾状态。
- [x] 组合练习锁定 90 个无序合法组合；目标测试覆盖等概率抽取、随机层转、Repeat 新打乱、相对奇偶和中层三策略，空范围按来源恢复。
- [x] 公式训练五组计数锁定为 `2 / 99 / 43 / 16 / 72 = 232`；全部非空公式可归一化，232 个逆 setup 合法，中层强制策略与 parity-aware setup 有目标测试覆盖。
- [x] inspector / visualizer / importer 的分享链接刷新后状态一致。
- [x] inspector 只在最终状态可切时计算奇偶；上下层 + / − 可键盘操作并跳到该方向最近的可切位置，六项计数与上游 solved fixture 一致。
- [x] 已实测页面在桌面和 `<480px` 下无横向溢出；横向工具栏会把当前页滚入可视区域。
- [x] `/alg/sq1/algorithm-trainer` 已在 390px 与 1280px 下完成新题、显示答案、键盘防误触、当前导航和无横向溢出复测。
- [x] `pnpm --filter @cuberoot/client typecheck`、目标 Vitest、`git diff --check` 通过。
- [x] 浏览器实测 `/zh/alg/sq1`、形状命名/训练、inspect / visualize / import / count / parity-game / train 以及 `/sim?...&tool=draw`；本轮另复测 390px 和 1280px 的命名训练、导入、数位与后段导航。

## 交付状态

- 本文档是后续实现的逐项跟踪单；未完成项不能因已有相近页面而直接标成完成。
- 本轮按用户最新要求提交并推送全部改动；上线状态以最终同一 SHA 的检查结果为准。
