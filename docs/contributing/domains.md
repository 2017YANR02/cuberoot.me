# 业务专项维护入口与规则

本文件承接根 [AGENTS.md](../../AGENTS.md) 中的对应细则（2026-11-05 整理），是当前维护规则，不是历史归档。涉及本主题时先读；当次用户指令优先。代码路径除明确标注外均相对仓库根目录，core 命令在 `core/` 执行。发布授权统一见[发布规则](release.md)。

按任务阅读对应小节。

## 战队名单导入

- **战队名单同名匹配（维护者要求，2026-11-02）**：导入战队名单时，姓名匹配到多个 WCA 选手，默认选择三阶 `333` 历史最佳有效平均成绩最快的一人，不再逐项询问。比较原始厘秒值，排除无成绩、DNF 和 DNS；保留候选 WCA ID、成绩及选中依据的导入记录。若候选均无有效三阶平均或最佳成绩并列，则单独列为待确认；没有姓名匹配结果时不得臆造 WCA ID。
- **战队包含未参赛成员（维护者要求，2026-11-02）**：WCA ID 不是加入战队名单的前提。维护者确认尚未参赛的成员也必须收录，在 `wca_person_teams` 保存真实姓名、战队与独立 `member_id`，`wca_id` 留空；目录人数、搜索和分页包含他们，展示姓名但不伪造 WCA 链接、国籍、成绩或排名。新增可用管理员 `POST /v1/wca/teams/members`（`name`、`teamId`），保存返回的 `memberId`，不要重复 POST 或把同名当成同一人；以后获得 WCA ID 时关联原成员记录，避免重复成员。只有未匹配且身份情况不明时才待确认，不能把已确认未参赛的人继续列为“导入失败”。维护者给定的 ID 优先于姓名搜索：高羽萱=`2019GAOY01`（官方姓名 Yuki Gao），刘南希=`2018LIUN01`（官方姓名 Nancy Liu）。

## WCA 统计筛选与数据一致性

- 为 WCA 纪录统计新增或修改级别／地区筛选时，必须使用 `WcaStatView` 的 `RecordSectionsView` 与 `selectRecordSection`；生成端通过 `GroupedStatistic` 输出带 `recordScope: { region, level, event, type }` 的分区，参考 `core/jobs/stats-build/src/core/record_scopes.ts` 和三个现有纪录统计。不得单独硬编码一套筛选选项。
- 筛选选项只来自当前条件下有行数据的分区；不能提供点进去才发现无数据的洲际、地区、项目或类型选项。只支持单次时，不提供平均或重复的“单次与平均”。整项统计未生成与某个组合确实无人达成要分别核实，不得把构建缺失当成无成绩。
- 先按地区、级别及适用的项目／类型计算排名，再分别截取 Top N；禁止在已经截断的全球榜单上过滤以冒充各洲或各项目完整榜单。世界纪录同时计入相应洲际／国家纪录；地区按选手取得成绩时的所属国家，不按比赛举办地。
- 新统计必须同时交付生成器和真实生成数据；修改 SQL 仍须遵守 `stats-build` skill 的实库校验要求。`tests/wca-record-filters.test.ts` 自动发现纪录统计并遍历全部生成分区，缺文件、缺筛选元数据、空分区、重复组合或不可达组合均失败。CI 用 `core/scripts/list-record-stat-fixtures.mjs` 同源发现需要检出的 JSON，不维护另一份新统计名单。
- 改用新数据形态或新渲染入口时，同步扩展上述发现逻辑及测试；自动检查只覆盖已纳管结构，不能代替新统计口径与数据完整性的审查。

## 登录系统与流程图同步

- `/dev/auth`（中文 `/zh/dev/auth`）是跨平台账号生命周期说明。修改登录/注册、第三方身份、绑定/解绑、找回密码、会话/回跳、合并或注销时，先读 `core/packages/client/app/[lang]/dev/auth/page.tsx`，同一任务同步流程图及中英文说明；不得把设计方案、已实现、已部署和真机验收混写。
- `tests/auth-doc-sync.test.ts` 已纳入 client test / CI：对已纳管的登录源码路径与内容计算指纹，新增、删除、改名同样触发，Windows 换行差异不触发。在 `core/` 运行 `node scripts/check-auth-doc-sync.mjs` 可独立检查。
- 完成流程复核后，用上述命令加 `--fingerprint` **只读取得**新指纹，在流程图源码的 `auth-doc-review` 注释中更新 `fingerprint` 与具体 `reason`。有行为变化必须改相应流程节点；仅重构/样式变化可保留图，但说明核对了哪些流程、为什么不变。禁止只刷新日期、只换指纹或自动生成空泛复核说明来消除失败。
- 新增不在命名/路径规则内的登录入口或原生适配时，同步守卫范围和覆盖测试；自动检查只能证明源码变化已被确认，不能代替语义审查。继续运行 `auth_flow_documentation.test.ts` 验证平台与生命周期边界。不得为了更新图新增第二套登录实现。

## 指法记号（公式库 / 教程 / 模拟器）

改指法、`algHtml` 标记含义、指法导入/导出或 AI 公式转换前，先读 [统一指法记号契约](../../docs/fingertrick-notation.md)。保留富文本和纯文本两种写法，共用语义；删除线表示中指、斜体表示拇指，下划线须结合转动与来源判断，禁全部替换成 `p`。动作编排另读 `core/packages/client/app/[lang]/sim/engine/hands/FINGERTRICKS.md`；严格区分记号规格、解析支持和动画验收。

## Space / Blender

Space 的 `.blend` 源工程及必要原始贴图纳入版本管理时必须使用 Git LFS，禁普通 Git 强制加入；`.blend1`、缓存和临时渲染不入库；当前暂缓 LFS 配置与资产上传，后续编辑先读 `design/space/README.md` 和 `docs/space-blender-tracker.md`。

## 论坛视频时长

“视频时长限制改成 X”=只改 `core/packages/shared/src/forum.ts` 的 `FORUM_VIDEO_MAX_DURATION_SECONDS`，前端提示/预检与服务端校验共用它。
