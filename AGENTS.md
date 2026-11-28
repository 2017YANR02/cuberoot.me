# AGENTS.md

按下表在相关操作前读取专题规则及目标目录内的 `AGENTS.md`；只读命中的入口，细则同样有效。当次用户明确指令优先。

## 通用约束

- 界面默认用留白、间距和对齐分组，避免多余边框和卡片套卡片。单个按钮、视频或一组相关操作无需单独加框。保留有实际作用的键盘焦点、选区和状态提示。
- 不创建、使用或切换 Git worktree（维护者要求，2026-11-11）；始终在现有 checkout 工作。遇到未提交修改或同步冲突，先备份、限定范围，在当前目录合并并保留他人修改，不覆盖、丢弃或夹带。
- 临时文件仅放 `.tmp/{png,scratch,cache}/`；持久数据用 `.local-data/`，源码归所属模块，正式入口不得依赖临时文件。具体存放与清理按下表读取。

## 维护者设备

- **Pro**：深空黑色 16 英寸 MacBook Pro，M5 Max（18 核 CPU、40 核 GPU），128 GB 统一内存，2 TB 存储。
- **Mini**：Mac mini，M5 Pro（18 核 CPU、20 核 GPU、16 核神经网络引擎），64 GB 统一内存，1 TB 存储，10Gb 以太网，背面三个雷雳 5 端口。
- **外星人**：Alienware m17 R4 笔记本，Windows 11。
- **显示器**：2026 款 27 英寸 Apple Studio Display XDR，纳米纹理玻璃面板，可调倾斜度和高度的支架。
- **设备界面验收**：维护者已打开 Xcode Device Hub，或明确要求检查某台设备的外屏、折叠态或横屏时，优先在 Device Hub 中使用对应设备、屏幕与姿态复现并验收，包括设备 Safari 内的本地网页。内置浏览器仍用于常规网页任务，其尺寸模拟不能代替设备验收。Device Hub 不可用时先说明，再由维护者决定是否使用其他方式。

## 按任务读取

| 任务 | 必读入口 |
| --- | --- |
| 文档归属、合并、迁移、Agent 阅读顺序 | [文档总入口](docs/README.md)；[文档维护](docs/contributing/documentation.md) |
| 代码修改、命令、启动/预览、构建/测试、代码量、流量排查、智能魔方验证 | [开发与验证](docs/contributing/development.md)；安装环境另读[本地配置](docs/contributing/local-setup.md) |
| 源码/模块归属、依赖、架构、upstream/fork | [架构边界](docs/contributing/architecture.md)；判断当前状态另读[跟踪表](docs/architecture/architecture-modernization-tracker.md) |
| commit/push/PR、CI、部署、数据库迁移 | [发布契约](docs/contributing/release.md) |
| 审批、备案、主体迁移、商店送审与上架 | [合规入口与工作台更新规则](docs/compliance/README.md) |
| React/CSS、组件/交互、身份展示、日期展示、主题、图片、导航 | [前端规范](docs/contributing/frontend.md) |
| URL/路由、SSR/SSG、标题/metadata/SEO、API 地址/缓存、nuqs | [网址与渲染](docs/contributing/routing.md) |
| 文案、多语言、WCA 翻译/规则引用、违禁词 | [多语言与翻译](docs/contributing/localization.md) |
| 战队导入、WCA 统计、登录同步、指法、Space/Blender、论坛视频 | [业务专项](docs/contributing/domains.md) |
| 本地求解、建表、基准、长期/批量计算、打乱统计、求解器 loop | [计算保护](docs/contributing/compute.md)，启动前全文读取，按具体授权与资源保护执行 |
| 创建、移动、清理本地产物，表/断点/证据的存放与交接 | [文件生命周期](docs/data/artifacts/local-artifact-lifecycle.md) |
| 双机开发、同步、交接、共同发布 | [双机流程](docs/contributing/multi-machine.md) |

技能按 catalog 的 trigger 使用，路径按 root alias 展开，不凭记忆或猜路径。新 UI 文案用 `i18n`，颜色/材质用 `theme-tokens`，路由/标题/SEO 用 `document-title`。

专题细则写入对应文档/skill；根文件只留通用约束和入口。迁移保留限定条件、例外、日期与替代关系，修复链接，不改变授权。
