# OLL DOCX 迁移跟踪

## 范围

- 来源：`.tmp/docx/OLL.docx`
- 目标：`/zh/alg/3x3/oll` 及 OLL 情况详情页
- 本轮只迁移 OLL，不处理 `D:\cube\CubeRoot\3x3` 中的其他 DOCX。
- 交付：可复跑 Skill、解析脚本、数据迁移、共享元数据展示、回归测试；提交但不 push。

## 已确认契约

- DOCX 共 6 页，主表覆盖 57 个 OLL 情况。
- 分类和情况顺序以 DOCX 为准。
- 所有绿色文字忽略；绿色箭头只表示相邻情况的打乱关系。
- DOCX 公式排在旧公式之前；近似重复时保留 DOCX 的 `2'` 方向写法。
- 图标映射：左单 `oh`、脚拧 `ft`、最少步 `fmc`、高阶 `big`、键盘 `key`。
- DOCX 单手公式均为左单；右单复用 PLL 的既有镜像与标签逻辑。
- 所有公式类型标签统一为灰色；类型筛选的默认项为“全部”，不再显示“公式”。
- 右单先取当前情况的 M 镜像 partner 的左单，再镜回当前情况；绿色箭头关系不能代替镜像关系。
- 图下五项依次为 `ETM, ETM*, HTM*, STM*, ATM*`。
- 情况详情复用 `AlgCaseView` 和 `AlgCaseMetaContent`，缺失元数据不显示。

## 进度

- [x] 阅读 DOCX、i18n、服务端迁移、公式管理与 Skill 创建规范。
- [x] 渲染并逐页检查 6 页 DOCX。
- [x] 建立 `.agents/skills/import-alg-docx` 初版。
- [x] 确认 57 个情况与五项指标字段顺序。
- [x] 完成通用 DOCX 解析脚本并固定图标哈希映射。
- [x] 生成 OLL 结构化清单并完成 57/57 结构对照。
- [x] 追溯并确认 PLL 左单到右单契约与 OLL 启用点。
- [x] 新增 OLL 数据迁移并验证公式前置、去重、分类和位置。
- [x] 扩展共享元数据类型与详情展示，加入 ETM 和 ATM。
- [x] 完成 targeted tests、Skill 校验、迁移幂等验证与 client typecheck。
- [x] 完成桌面和小于 480px 的浏览器验收。
- [x] 复核任务 diff 并仅提交本任务文件。

## 验证记录

| 阶段 | 证据 | 结果 |
|---|---|---|
| DOCX 渲染 | Word 只读导出 PDF，144 DPI 渲染 6 页 | 6/6 已检查 |
| 主表结构 | 55 行、左右成对单元格 | 57 个唯一情况 |
| 解析结果 | 17 个分类、269 条非绿色公式 | 情况编号 1–57 连续且唯一 |
| 类型图标 | `oh=65, ft=18, fmc=14, big=30, key=28` | 5 种图标全部由内容哈希识别，无未知图标 |
| 绿色箭头 | 6 组双向关系 | 12 个情况写入 `scrambleFrom`，不计作公式 |
| 精确记号 | OLL 1 首条为 `(R U2' R2' F R F') U2' (R' F R F')` | `2'` 未被归一化丢失 |
| OLL 镜像 | 对 57 个现有 setup 做 M 平面镜像并按 OLL 朝向状态匹配 | 57/57 唯一命中，关系全部对合或自镜像 |
| 右单旧实现 | 会话 `右单公式` 与当前 `alg_oh_hand.ts` | partner 优先、复用 `/sim` 镜像、`oh-right` 不入库 |
| 当前 API | `GET /v1/alg/sets/3x3/oll` | 57 个现有情况，待合并 |
| 迁移本地实跑 | PostgreSQL 18 临时库连续执行 `0153` 两次 | 57 情况、17 分类、270 条含 1 条测试旧公式；DOCX 块 269 条始终在前，近似旧公式 0 条，非重复旧公式 1 条，镜像错误 0 |
| Targeted tests | `oll_docx_import`、`alg_oh_hand`、`alg_case_optimal` | 3 文件、15 项通过 |
| Client typecheck | `pnpm --filter @cuberoot/client typecheck` | tsgo 通过 |
| 最终工作区 typecheck 复跑 | 同一命令 | 本任务通过后出现的并行 `teaching-saas-api.ts` 改动有 13 个未使用声明；均不在本任务暂存范围 |
| Skill 校验 | 官方 `quick_validate.py` | `Skill is valid!` |
| 浏览器桌面 | 本地接口仅在浏览器内替换为迁移后响应，分类页与 OLL 1 详情页 | 17 个分类按 DOCX 排序，首项 OLL 27；OLL 1 精确 `2'` 公式在前；详情展示 ETM 与 ETM/HTM/STM/ATM 最优值 |
| 右单筛选 | 分类页选择 `右单` | URL 为 `?tag=oh&hand=right`，43 个情况、65 条派生公式 |
| 类型展示回归 | `alg_oh_hand.test.ts` 7 项通过；浏览器读取计算样式 | 左单与高阶的文字色、背景色完全一致；筛选首项为“全部 / All” |
| 浏览器窄屏 | 实际约 387×840 CSS 视口 | 分类页 17 个分类、首项 OLL 27，无页面横向溢出；详情页元数据可见 |

浏览器验收没有写本地或线上数据库，只在请求层临时注入与迁移结果同形的数据。控制浏览器的扩展产生了既有的 message channel listener 报错；页面本身未出现 React、数据解析或运行时错误。

## 原文校验异常

以下公式已逐页确认与 DOCX 原文一致，因此按本次“以 DOCX 为准”的要求原样保留，并用精确测试锁定；异常集合增减都会失败。

- OLL 24：`U x (l B' l' U) (l B l' U') x'`，F2L 完整，但顶层状态不是当前 OLL 24。
- OLL 25：`U x (l B l' U) (l B' l' U') x'`，F2L 完整，但顶层状态不是当前 OLL 25。
- OLL 30：`x' U2 (R U R' D) (R U2 R U) R2' D' x`，顶层状态不匹配且破坏 F2L。
- OLL 55：`r U2' (r' l') U2 r U2' r' U2 (r l) U2' r'`，顶层状态不匹配且破坏 F2L。
- OLL 2：`U2 (F R U R' U' F') U2 (F U R U' R' f')`，顶层状态不匹配且破坏 F2L。

其余 264 条 DOCX 公式均通过当前情况状态和 OLL 前置条件校验；269 条均使用公式自身的规范化逆公式驱动播放器，并在四个观察角下回到复原态。右单派生中仅 OLL 24、25 对应的两条镜像继承了上述顶层状态差异，其余均通过。

## 并行改动边界

- 工作区已有其他任务改动。
- `packages/client/app/[lang]/dev/schema/page.tsx` 和迁移编号 `0151` 已被其他任务占用；本任务使用下一个可用编号并只提交自己的精确路径或 hunk。
