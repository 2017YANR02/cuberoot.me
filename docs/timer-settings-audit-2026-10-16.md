# /timer 设置审计（2026-10-16）

本轮修改仅本地提交，未推送或部署。范围包含单人设置的 8 类、共享契约的 67 个字段/命令、12 个工具动作，以及 2/3/4 人对战设置。67 是契约条目数，不是同一屏可见控件数；包含条件显示、旧兼容字段及宿主差异。

## 已修复

| 问题 | 修复及证据 |
| --- | --- |
| 按住阈值逐字符归一化，清空重输时被立即夹到下限 | 输入保留草稿，失焦或 Enter 时归一化；空值恢复已有值。浏览器重输及组件回归通过。 |
| 自动备份间隔清空重输时瞬间变 0，可能禁用备份并重置计数 | 同样改为提交时保存；隔离回归确认编辑中不写设置。 |
| 额外观察提示在节拍器关闭时无法修改或关闭，但运行逻辑独立响铃 | 解除错误禁用，说明与提示音/节拍器独立及 WCA 观察前提；音量始终可调。组件回归覆盖关闭节拍器时清空提示。实际听感待真机。 |
| 重复应用相同同步种子会重置打乱序号 | 相同种子的应用按钮禁用，Enter 也受保护；序号归零仍有独立按钮。隔离回归通过。 |
| 多人“全部重置”实际删除对战成绩，文案不能说明后果 | 改为“清空对战成绩”，说明保留设置，增加明确不可撤销确认；隔离回归验证取消不删除、确认才调用处理器。未清空真实数据。 |
| 多人按键录制会把 Ctrl/Cmd/Alt 组合键中的字母录入 | 忽略这些修饰键组合；回归通过，浏览器 Escape 取消录制保留原键。 |
| 分组 CSS 选择器写错，分隔未生效；窄屏开关与标签错位 | 修正选择器，统一纵向间距、开关右对齐，窄屏保留同一行，增加触摸空间；8 类在 390px 下均无水平溢出。 |
| 深色遮罩由前景色混合，背景反而发白 | 改用主题遮罩及背景色回退；系统明/暗、显式明/暗的四种组合实查通过。 |

## 编排调整

- 计时先放观察和起表，再放读数/精度，最后放项目与分组联动。
- 智能魔方拆为预备与起表、实况与姿态、完成还原后；管理员假魔方折叠到开发调试。
- 外观拆为字体、显示与操作、成绩排名，并指向已有“调整布局”入口修改字号。
- 声音区分提示音、节拍器、额外观察提示，解释各自开关作用。
- 工具按钮移到各分类设置之后；快捷键优先，同步种子、历史复盘重算折叠收纳。
- 多人常用计时/按键在前，打乱来源随后，背景与打乱大小折叠，清空成绩独立在底部。
- 增加分类说明、当前设备自动保存提示、音量百分比和输入控件可访问名称。
- 本轮不删除功能：缺乏实际使用数据，低频功能先折叠，保持原数据与能力兼容。

## 逐项清单

以下逐项核对控件、显示/禁用条件及处理器；不表示所有真实设备、网络写入与算法结果都完成了端到端验收。“常规”仍受宿主/旧兼容差异约束。Web 已不显示旧“计时模式”开关；计时器/打乱字号使用“调整布局”，没有在设置里重复提供。

### 计时

| 项目 | 显示条件 | 禁用条件 | 稳定 ID |
| --- | --- | --- | --- |
| 计时模式 | 常规 | — | `settings.timer.enabled` |
| WCA 观察 | 常规 | — | `settings.timer.inspection` |
| 按住阈值（毫秒） | 常规 | — | `settings.timer.hold-threshold` |
| 隐藏运行中的时间 | 常规 | — | `settings.timer.hide-running-time` |
| 计时中精度 | 常规 | — | `settings.timer.running-precision` |
| 成绩精度 | 常规 | — | `settings.timer.result-precision` |
| 切换项目时匹配分组 | 常规 | — | `settings.timer.auto-session-for-event` |
| 切换分组时匹配项目 | 常规 | — | `settings.timer.auto-event-for-session` |

### 智能魔方

| 项目 | 显示条件 | 禁用条件 | 稳定 ID |
| --- | --- | --- | --- |
| 假魔方 | 仅管理员 | — | `settings.smart-cube.fake-cube` |
| 智能魔方自动预备 | 常规 | — | `settings.smart-cube.auto-ready` |
| 陀螺仪 | 常规 | — | `settings.smart-cube.gyro` |
| 打乱剩最后一步时自动重置朝向 | 常规 | — | `settings.smart-cube.auto-calibrate` |
| 实况魔方 | 常规 | — | `settings.smart-cube.live-view` |
| 记录姿态用于回放 | 常规 | — | `settings.smart-cube.record-orientation` |
| 结束后自动打开复盘 | 常规 | — | `settings.smart-cube.auto-recap` |
| 结束后自动打开解法 | 常规 | — | `settings.smart-cube.auto-solution` |
| 训练朝向 | 常规 | — | `settings.scramble.training-pre-orientation` |

### 打乱

| 项目 | 显示条件 | 禁用条件 | 稳定 ID |
| --- | --- | --- | --- |
| 最优打乱 | 非二阶 | 项目、来源、登录或同步种子限制 | `settings.scramble.optimal` |
| 完成真题后自动打卡 | WCA 真题来源 | — | `settings.scramble.auto-mark-wca` |
| 预打乱朝向 | 常规 | — | `settings.scramble.pre-orientation` |
| 颜色中立 | 支持颜色中立的项目 | — | `settings.scramble.color-neutral` |

### 训练

| 项目 | 显示条件 | 禁用条件 | 稳定 ID |
| --- | --- | --- | --- |
| CFOP 分阶段计时 | 支持分段的项目 | — | `settings.training.stage-splits` |
| 盲拧记忆 / 执行分段 | 盲拧项目 | — | `settings.training.bld-memo-split` |
| 目标时间 | 常规 | — | `settings.training.target-time` |
| 每日目标次数 | 常规 | — | `settings.training.daily-goal` |
| 轮次模拟 | 常规 | — | `settings.training.round-enabled` |
| 赛制 | 轮次模拟开启 | — | `settings.training.round-format` |
| 过关线 | 轮次模拟开启 | — | `settings.training.round-cutoff` |
| 时限 | 轮次模拟开启 | — | `settings.training.round-time-limit` |
| 时限口径 | 轮次模拟开启 | — | `settings.training.round-cumulative` |

### 外观

| 项目 | 显示条件 | 禁用条件 | 稳定 ID |
| --- | --- | --- | --- |
| 计时器字体 | 常规 | — | `settings.appearance.timer-font` |
| 计时器字号 | 常规 | — | `settings.appearance.timer-font-scale` |
| 打乱字体 | 常规 | — | `settings.appearance.scramble-font` |
| 打乱字号 | 常规 | — | `settings.appearance.scramble-font-scale` |
| 紧凑打乱 | 常规 | — | `settings.appearance.compact-scramble` |
| 打乱图 | 常规 | — | `settings.appearance.scramble-image` |
| 3D 立方体 | 常规 | 打乱图关闭 | `settings.appearance.cube-3d` |
| 点击打乱条 | 常规 | — | `settings.appearance.scramble-click-action` |
| 运行中隐藏全部 UI | 常规 | — | `settings.appearance.hide-all-while-running` |
| 排名范围 | 常规 | — | `settings.appearance.rank-scopes` |
| 地区排名 | 开启地区排名且账号未提供地区 | — | `settings.appearance.ranking-region` |

### 声音与节奏

| 项目 | 显示条件 | 禁用条件 | 稳定 ID |
| --- | --- | --- | --- |
| 提示音 | 常规 | — | `settings.sound.enabled` |
| 音量 | 常规 | — | `settings.sound.volume` |
| 语音观察 | 常规 | 提示音关闭或设备无语音 | `settings.sound.voice-inspection` |
| 开启节拍器 | 常规 | — | `settings.sound.metronome-enabled` |
| 速度 | 常规 | 节拍器关闭 | `settings.sound.metronome-tempo` |
| 观察提示音（秒） | 常规 | — | `settings.sound.inspection-beeps` |

### 数据

| 项目 | 显示条件 | 禁用条件 | 稳定 ID |
| --- | --- | --- | --- |
| 每完成 N 次自动备份 | 常规 | — | `settings.data.auto-backup-frequency` |
| 立即备份 | 常规 | — | `settings.data.local-backup-create` |
| 查看备份 | 常规 | — | `settings.data.local-backup-list` |
| 恢复 | 备份列表展开 | — | `settings.data.local-backup-restore` |
| 登录后备份到云端 | 未登录 | — | `settings.data.cloud-sign-in` |
| 上传到云端 | 已登录 | 云操作中 | `settings.data.cloud-upload` |
| 从云端恢复 | 已登录 | 云操作中 | `settings.data.cloud-restore` |
| 一键导入 | 常规 | 导入中 | `settings.data.import-file` |
| 选择项目 | 导入待映射 | — | `settings.data.import-session-mapping` |
| 完成导入 | 导入待映射 | 项目映射未完成 | `settings.data.import-complete` |
| CubeRoot JSON | 常规 | — | `settings.data.export-cuberoot` |
| csTimer JSON | 常规 | — | `settings.data.export-cstimer` |
| CSV | 常规 | — | `settings.data.export-csv` |
| Speedstacks | 常规 | — | `settings.data.export-speedstacks` |
| 重算分阶段数据 | 常规 | 重算中 | `settings.data.reanalyze` |

### 高级

| 项目 | 显示条件 | 禁用条件 | 稳定 ID |
| --- | --- | --- | --- |
| 种子 | 常规 | 应用按钮：空值或与当前相同 | `settings.advanced.sync-seed` |
| 当前 | 常规 | 未使用种子 | `settings.advanced.sync-seed-counter` |
| 快捷键绑定 | 常规 | — | `settings.advanced.keymap` |
| 恢复默认快捷键 | 常规 | — | `settings.advanced.reset-keymap` |
| 恢复默认 | 常规 | — | `settings.advanced.reset-defaults` |

### 附属工具（12 项）

| 工具 | 核对范围 |
| --- | --- |
| 打乱足迹 | 导航目标及语言前缀 |
| 统计 | 窄屏条件、打开完整统计处理器 |
| 语言 | 窄屏条件、语言及 URL 同步；本轮中英文设置实查 |
| 专项练习 | 支持项目条件、打开练习选择器处理器 |
| 盲拧助手 | 盲拧项目条件、工具处理器 |
| 全屏 | 开启/退出标签、关闭设置时保留用户手势的调用顺序 |
| 手动录入 | 浏览器打开、空时间不能保存、取消关闭；未新增成绩 |
| 粘贴 replay 链接 | 输入弹窗及导入处理器；未导入真实记录 |
| 通用求解器 | 工具打开处理器；求解正确性不属于本轮设置改动 |
| 批量打乱 | 浏览器打开入口；未运行批量计算 |
| 打印 | 打印处理器；系统打印窗口/纸张输出待人工 |
| 清空当前项目 | 按当前项目及成绩数生成确认、无成绩时禁用；未删除真实数据 |

### 多人设置

核对 2/3/4 人模式：双人对坐/并排、3/4 人上排旋转、精度、观察时长、按住起表、打乱图、同时开始、隐藏读数、每位玩家按键、设备入口、打乱来源及筛选、背景/大小、清空对战成绩。浏览器切换人数后控件数量和布局正确，4 人 390px 无水平溢出；不代表多键同按或设备连接已验证。

## 验证记录

- 浏览器：本地现有 Next dev，桌面与 390px；遍历全部 8 类，检查滚动与溢出、中英文标签、明暗主题、轮次展开、打乱图和 3D 依赖、阈值重输、备份列表展开收起、低频区展开、多人模式。测试改动的持久偏好恢复原值，最终恢复中文单人视图。
- 9 个相关测试文件共 375 项通过：设置面板、计时 UI、契约、智能魔方字段、编辑边界、对战设置、数据备份 UI、IndexedDB 备份、自动备份计数。自动备份计数测试原 Node 环境缺少浏览器 document，对宿主环境判断增加测试 mock 后 4 项通过；未据此修改生产逻辑。
- client、timer-ui 类型检查通过；shared 必要构建通过；diff 空白检查通过。
- 本轮没有触发真实导入、覆盖云端/本机备份、删除成绩或恢复默认。原生确认框在 IAB 的自动操作出现超时，不能据此宣称浏览器确认路径通过；对战取消/确认行为的证据来自隔离组件回归。
- 未运行 Next build（复用正在运行的 dev）、全套测试、物理 BLE 或原生客户端验收。共享组件变化会被其他宿主消费，Web 验证不等于 iOS/Android 验证。

## 需要人工复核

1. **GAN 16 UI**：连接后分别试打乱正确、静止 2 秒、双反扭三种预备方式；校准时的握持朝向、关闭/开启陀螺仪、姿态回放和结束后复盘/解法。确认首次转动起表、完成还原停表，平台分别记账。
2. **手机声音与触摸**：Safari/Android 浏览器亲耳核对 8/12 秒语音、额外提示时间、节拍器、音量和静音；锁屏/回前台后再试一次。用触摸验证长按阈值和遮罩关闭。
3. **多人实体键盘**：2–4 人同时按键，验证硬件冲突/鬼键、同时开始和分别停表。此类问题无法由 DOM 模拟证明。
4. **数据和系统交互**：先在独立测试浏览器资料中使用可丢弃成绩，验证四种导出、各来源导入、备份恢复、清空取消/确认和恢复默认；再核对系统全屏/打印。不要在唯一真实数据副本上做破坏性验收。

## 事实源

- 共享设置契约：`core/packages/shared/src/timer/settings-contract.ts`
- 工具契约：`core/packages/shared/src/timer/more-actions.ts`
- Web 编排：`core/packages/client/app/[lang]/timer/_components/SettingsPanel.tsx`
- Web 工具处理器：`core/packages/client/app/[lang]/timer/_shell/SoloView.tsx`
- 共用控件与对战设置：`core/packages/timer-ui/src/Timer*Settings*.tsx`
