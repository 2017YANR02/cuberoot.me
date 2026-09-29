# AI 二阶魔方实验

页面：`/sim/agents`、`/zh/sim/agents`。首页搜索框下提供入口。
视觉参考：[ClaudeDevs 演示](https://x.com/ClaudeDevs/status/2104641318555353400)；页面和编排为本站实现，3D 复用现有 NxN 引擎，没有引入视频资源或第三方源码。

## 运行契约

- 展示页直接读取同目录 `_recorded-run.json`，只有播放、暂停、进度和速度控制；无论是否管理员都不从页面发起付费调用，也不依赖线上 API 是否已经发布。更新展示内容须显式录制新记录并发布页面。
- `GET /v1/cube-agents` 保留为实验工具，公开返回可用状态、运行状态和最近记录；固定展示页不调用它。
- `POST /v1/cube-agents/runs` 仅管理员或既有 `X-Admin-Key` 通道，SSE 返回真实记录；只接受 `difficulty: 2 | 3 | 5 | 8`。
- 两组共用同一 U/R/F 打乱，均关闭思考模式。每组先调用一次协调模型分配四个策略，再并行调用四个代理；每代理最多六轮，总计最多 50 次模型调用。单请求 30 秒、整轮 120 秒；每次最大输出 512 tokens、输入 JSON 最多 12,000 字符。CLI 可固定题目，API 使用随机题目。
- 模型只收到角块状态、U/R/F 置换和扭转规则、自己先前的验证反馈。隐藏打乱和求解器答案不会发给模型。模型返回 `moves` JSON；服务器用 cubing.js 的实际二阶状态验证，禁止任意代码执行。
- 每次候选都从原始状态测试；统计每组走过的不同角块状态。首先验证成功的代理获胜；其余已在途请求继续读取 usage，再结束结算。
- 单进程最多一个实验，北京时间每天最多 20 轮，失败也占额度；断连或停止取消请求。当前部署为单 API 进程；改多实例前必须把锁和额度迁到共享持久存储。
- `data/cube-agents/{latest,quota}.json` 原子保存。每次事件保存进度；进程重启后残留的运行记录显示停止，在途用量标记不完整。可用 `CUBE_AGENTS_DATA_DIR` 指定持久目录，不能放在发布时被清空的构建目录。
- 浏览器不持有供应商密钥。千问使用 `SITE_ASSISTANT_API_KEY` 与北京区 `SITE_ASSISTANT_BASE_URL`；DeepSeek 使用 `DEEPSEEK_API_KEY`，只发送到固定官方地址 `https://api.deepseek.com`。两组凭据和思考模式参数分开，模型白名单在 shared 契约中。未授权模型返回明确的访问错误，不换凭据绕过。

## 用量与价格

费用来自 API 返回的 input/output tokens，不根据耗时或动画估算。包含协调者和四代理，按未扣缓存、空闲时段折扣和免费额度的人民币原价计算；DeepSeek 使用高峰标准价。此值不是实际扣款。失败或取消且未收到 usage 时显示不完整，不报零费用。记录保留模型实际 ID、供应商返回的模型名、该次价格快照和缓存 tokens，后续更换配置不会给旧结果换标签。

2026-09-29 UTC 核对官方价格：北京区 Qwen3.8 Flash（`qwen3.8-flash`）每百万输入/输出 ¥0.8/¥2.7；DeepSeek V4.1 Flash（`deepseek-flash`）高峰未缓存输入/输出 ¥2/¥8，缓存输入 ¥0.04，空闲时段为高峰价格的一半。来源：[Qwen3.8 Flash](https://help.aliyun.com/zh/model-studio/qwen3-8-flash)、[DeepSeek 官方人民币价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)。变更模型、地区或计费档位必须同时更新常量；已有记录保留原价格。

## 当前交付证据

- 本地调用两家官方服务，最终记录为 `ccb2d8e7-0fdb-4259-82de-0bf3254d68c0`，开始于 `2026-09-29T04:36:20.731Z`，共同打乱 `R U`。
- Qwen3.8：14.312 秒，25 次模型调用、24 次有效验证、66 个状态，15,956 输入 + 543 输出 tokens，原价估算 ¥0.0142309；未还原。
- DeepSeek：8.185 秒，25 次模型调用、22 次有效验证、69 个状态，16,124 输入 + 519 输出 tokens（其中 10,752 输入 tokens 命中缓存），高峰原价估算 ¥0.0364；未还原。无效转法也消耗模型调用，但不计入有效验证。
- 完整公开记录的唯一展示源：`core/packages/client/app/[lang]/sim/agents/_recorded-run.json`。固定回放如实保留未还原结果；没有伪造赢家。
- 先前 Qwen3.7 无权限的记录保留在 `docs/benchmarks/cube-agents-2026-09-28.json`；首次 DeepSeek 接入时 Qwen 协调响应未通过格式校验的记录保留在 `docs/benchmarks/cube-agents-qwen-deepseek-2026-09-29.json`。额外一次协调请求用于诊断。后续真实响应出现 162 字符策略，确认原 160 字符硬上限会拒绝合法的四策略结构；现放宽有界策略文字，但继续严格校验四项结构和实际转法。
- API 定向测试验证独立求解校验、50 次调用上限、在途计费、拒绝任意代码、权限、取消、快照恢复；前端测试验证逐次复位、反向定位、中间转角、完整播放短间隔尝试和胜利展开时机。
- 新固定回放页使用实际记录直接渲染，无 GET 拦截或模拟响应。类型检查与全部记录逐项校验通过后提交；提交、发布和线上验收仍是分别记录的步骤。

真实供应商冒烟入口 `core/apps/api/scripts/cube-agents-smoke.ts` 必须显式传 `--run --output=/absolute/path.json`，可附 `--scramble="R U"`；它会产生实际模型费用。无需为了页面回放重复调用模型。

发布仍遵循 AGENTS.md：核对 `deploy_core.yml`（API）、`deploy_next.yml` 和 Vercel（页面）触发范围，分别观察对应提交的 CI、上线健康和实际浏览器结果；不把本地测试或 commit 当成上线证明。
