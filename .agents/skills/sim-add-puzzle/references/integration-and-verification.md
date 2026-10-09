# 新魔方跨页面接入与预览验收

按用户请求选择适用入口；只加模拟器时，不自动扩展求解页、分布页、Timer 或部署。
本文件的代码路径相对仓库 `core/`；Git 操作、发布授权和验证范围遵循根 `AGENTS.md`。

## 目录

- [确认共享事实源](#确认共享事实源)
- [接入打乱生成页](#接入打乱生成页)
- [接入计时器](#接入计时器)
- [选择最小验证](#选择最小验证)
- [提供可访问预览](#提供可访问预览)
- [判定浏览器验收](#判定浏览器验收)
- [交付证据](#交付证据)

## 确认共享事实源

- 先搜索现有状态模型、生成器、公开出口和消费者，再确定需要新增的能力。
- 将可跨运行时复用的纯状态、记号解析和打乱生成放在 `packages/puzzle-solvers/src/`；具体算法按 `new-substep-solver` 分流。
- 将共享几何和 SVG 放在 `packages/puzzle-render-core/src/`；修改真实实现，保留 client 中已有的薄包装。
- 统一事件 ID、记号、配色及状态含义；让模拟器、生成页和 Timer 消费同一份纯实现，避免按页面复制生成器。
- 核实上游是否支持目标事件；原生项目记录真实结构来源和自有抽样政策，禁止为了进入旧分支伪造 csTimer key。
- 给生成器注入随机源，使普通生成和种子生成复用算法；用独立状态模型核对结果，避免生成器与判据共享同一错误假设。
- 新增公开 subpath 时同步所属 `package.json` 的 `exports` 和适用的运行时分类；跨包只导入公开出口，禁止私有 deep import。
- 按实际消费者核对 Node 的 `dist` 出口与浏览器源码出口；修改 shared 后按根规则构建 shared，缺失的其他构建产物按依赖顺序补齐。
- 让同一应用内的引擎构造器、`tweener` 与 `timing` 保持同一源码入口；不要只给新引擎添加 `node → dist` 条件而保留 World 与公共动画时钟指向 `src`，并用真实公共时钟推进中间帧验证单例一致。
- 对承诺原生 Node 消费的纯出口实际执行构建后的 `import()`；沿用宿主支持的构建策略，纯模块可参考 Magic 的 Node ESM bundle，保留浏览器源码路径，不要只为 Node 把源码相对路径改成 Turbopack 找不到的 `.js`。
- 新增被 Timer/app-ui 消费的 Node `dist` 出口时，检查干净 mobile/desktop/test 构建前置是否产出该包；本地残留 dist、esbuild 成功或 typecheck 不能替代实际 Next 编译和干净消费者验证。

## 接入打乱生成页

核对 `packages/client/app/[lang]/scramble/gen/page.tsx` 的三个用户模式，不把两个实现组件写成两个用户模式。

| 用户模式 | 实现组件（相对生成页目录） | 验收内容 |
| --- | --- | --- |
| 比赛 | `TNoodleMode.tsx` | 项目可选，正式打乱、备打及图示可生成 |
| 批量 | `QuickMode.tsx`，`subMode="batch"` | 项目可选，数量与生成结果一致 |
| 输入 | `QuickMode.tsx`，`subMode="paste"` | 项目可选，粘贴记号按该项目显示图示 |

- 将无上游事件键的生成器接入 `packages/client/lib/native-scramble.ts`，由其派生事件 ID、双语名称和选择器项。
- 让比赛和批量的生成分支复用该 native 入口；让输入模式复用同一项目识别和图示入口。
- 通过生成页 `_event-picker.ts` 处理分组；使用真实图标或可读 `textLabel`，核对多选后结果对应所选项目。
- 将共享 SVG 接入 `packages/client/components/scramble-preview-svg.ts` 的支持列表和分发；从解析后的状态生成颜色和片位。
- 在生成页 `_tnoodle-pdf.ts` 核对图示入口与宽高比；让网页、PDF 和 Timer 共用 SVG，避免各画一份轮廓或调色表。
- 分别检查还原态与合法打乱态，核对片数、面色和方向；错误输入不得静默画成另一个项目或宣称已还原。

## 接入计时器

按职责修改共享事实源，让各端消费共享结果。

| 职责 | 路径 |
| --- | --- |
| 事件类型、双语名称、语义分组 | `packages/shared/src/timer/types.ts` |
| 选择器布局、图标与文字徽标 | `packages/shared/src/timer/event-catalog.ts` |
| 普通生成能力与 provider | `packages/shared/src/timer/scramble-runtime.ts` |
| 种子生成 | `packages/shared/src/timer/seeded/generate.ts` |
| csTimer 交换格式 | `packages/shared/src/timer/export-cstimer.ts`、`import-cstimer.ts` |

- 在 `TIMER_SCRAMBLE_CAPABILITIES` 注册真实能力；按 `timerScrambleCapability` 选择 shared、worker、manual 等现有分支。
- 让普通生成和种子生成调用同一纯生成器；按同一随机输入核对结果，保留确定性和来源信息。
- 从 `TIMER_EVENT_PICKER_ITEMS` 或其查询函数读取可展示项目；允许 `icon` 或 `textLabel`，不要要求每个非 WCA 项目都有 csTimer key 和图标。
- 区分事件语义分组与选择器视觉分组；保留各自契约，不要求 `nonwca` 与选择器的 `other` 字面相等。
- 核对 Timer 的实际 SVG 消费入口；保持普通与种子打乱的图示、计时记录和项目 ID 一致。
- 无 csTimer 对应类型时使用其真实支持的 `input` 类型，并保存 `cuberootEvent` 元数据；导入优先读元数据，核对改组名后仍能往返。
- 只修改本任务适用的对战事件范围；单人项目增加不意味着自动加入对战列表。

## 选择最小验证

按最终差异选择已有契约；仅在具体风险没有覆盖时补必要用例，不为文档或可逆样式改动新建程序测试。

| 变更类别 | 核对或运行的最小契约 |
| --- | --- |
| puzzle-solvers 公开 subpath | 所属 `package.json` 与 `packages/client/tests/puzzle-solvers-package-contract.test.ts` 的 `PUBLIC_SUBPATHS`、Node/browser 出口 |
| Timer 事件、来源或选择器 | `packages/client/tests/timer_battle_event_sync.test.ts`、`timer_nonwca_scramble.test.ts`；按变更选择相关断言 |
| Timer 导入导出 | `packages/client/tests/timer_cstimer_io.test.ts` 及 `timer_battle_event_sync.test.ts` 的逐项目往返契约 |
| app-ui 来源消费 | 仅影响该消费者时检查 `packages/app-ui/src/scramble-source-contract.test.ts`、`scramble-source-matrix.audit.test.ts` |
| 原生生成页接入 | 参考 `packages/client/tests/pyraminx-duo-native-scramble.test.ts` 的 native 路由、选择器和公开名称契约 |
| 新增脚本子进程 | `architecture-boundaries.json` 的 `manualContracts` 与 `packages/client/tests/architecture-boundary-guard.test.ts` |

- 更新公开出口列表和合法来源类型，保留严格断言；不要伪造 provider、添加无效图标或放宽断言来让旧契约通过。
- 新增 `spawn`、`spawnSync`、`execFile` 等调用时，登记精确文件、mechanism、target、count 和有效证据；按 schema 使用适合子进程的契约类型。
- 将验证脚本限制为固定目标、固定参数、无 shell 和有界超时；禁止把用户输入拼成可执行命令。
- 按精确新增边同步受影响的数量断言，保留历史 `legacyFindings` 基线；禁止添加新债务或泛化例外来消除失败。本参考不记录跨版本的固定计数。
- 在最后一次源码或测试改动之后检查受影响契约；新加测试里的依赖与子进程也属于变更范围。
- 从 `core/` 运行现有目标命令；单测使用 `pnpm --filter @cuberoot/client exec vitest run tests/具体文件.test.ts` 的形式，禁止 `test -- <path>` 意外触发全集。
- 必要时运行 `pnpm --filter @cuberoot/client typecheck`；dev 正在运行时遵循根规则，不在同一构建目录执行 `next build`。
- push 后观察对应提交的 CI；区分通过、失败、跳过和未运行，构建部署成功不代表测试工作流通过。

## 提供可访问预览

- 先核对当前分支、提交 SHA、已有开发服务和任务授权；复用现有服务或已存在的 PR 部署。
- 从仓库部署状态或现有集成获取预览 URL，并核对其分支与提交；不要猜测部署地址或把旧部署当作当前改动。
- 说明 `localhost` 指向打开链接的那台设备；远程 PR 更新不会自动切换用户本地分支或运行中的服务。
- 用户要在其本机查看时，先确认运行目标分支和正确服务；保留其他人的未提交修改，不擅自重启他人进程。
- 用户要可访问网页时，优先交付已存在且可验证的预览；不要仅因此创建新托管项目、修改 DNS 或更换提供商。
- 遇到认证墙时复用当前允许的登录方式，遵循浏览器工具的安全登录与手动接管流程；不在聊天或文档中收集密码、验证码，不为预览关闭访问保护。
- 发布与访问授权沿用当前任务和根 `AGENTS.md`；本参考不授权合并、生产发布或更改账号安全设置。
- 用户指出正式站缺少已做功能时，对比正式站、PR head 和部署提交；用户已授权合并时完成适用检查后直接合并，再检查主分支的实际部署及正式入口，不重复索取授权或把预览成功当作正式站已更新。

## 判定浏览器验收

使用当前工具允许的可见 UI、DOM、截图和日志取证；不要向页面注入 hidden world、React 私有状态或任意引擎调试句柄。
需要逐块状态、矩阵或碰撞证据时，使用仓库本地独立脚本，并与真实浏览器交互证据分别记录。

| 实际证据 | 结论与下一步 |
| --- | --- |
| 登录或权限提示 | 记录访问受阻，完成允许的登录后重开目标页面；尚未验收应用 |
| 网络、资源加载或应用异常日志 | 按对应错误排查，不能归因为 WebGL |
| 明确的 WebGL context 创建失败日志 | 记录当前浏览器该次渲染能力受阻；继续验证可用 SVG 与页面功能 |
| 页面正常但画布空白、缺少明确原因 | 核对 canvas 尺寸、显示状态及日志；保持原因未定，不推断所有云浏览器都禁用 WebGL |
| 真实模型可见且实际转动、拖拽、回放成功 | 记录对应页面、动作、可见状态及截图，声明已验证的具体交互 |

- 源码接线、HTTP 200、构建成功、SVG 或无浏览器离线渲染只证明各自覆盖的部分；不要据此宣称 3D 浏览器验收通过。
- 在可用的 3D 浏览器中检查还原态、随机打乱终态、转动中间帧、拖拽追加 token 和回放；以可见模型变化核对动作。
- 3D 受阻时优先完成生成页、Timer 和 SVG 的有用验证，并提供可打开的链接；明确保留尚未验证的动画与拖拽。
- 截取实际操作后的页面，不以设计稿或离线帧替代浏览器结果；按照当前工具规定保存截图，不让截图落点触发开发服务重载。

## 交付证据

- 给出对应分支或提交的可访问 URL，明确预览与本地服务的区别。
- 列出本次实际打开的页面、执行的关键动作及结果；按需附真实截图。
- 单独说明测试、部署、SVG 和 3D 交互各自的验证状态，保留具体未完成项。
- 不在长期技能中保存账号、一次性认证信息、固定部署域名、PR 编号或当次故障故事。
