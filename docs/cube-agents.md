# AI 二阶魔方实验

页面：`/sim/agents`、`/zh/sim/agents`。首页搜索框下提供入口。
视觉参考：[ClaudeDevs 演示](https://x.com/ClaudeDevs/status/2104641318555353400)；页面和编排为本站实现，3D 复用现有 NxN 引擎，没有引入视频资源或第三方源码。

## 运行契约

- `GET /v1/cube-agents` 公开返回可用状态、运行状态和最近记录；旁观者在实验进行时每两秒刷新。
- `POST /v1/cube-agents/runs` 仅管理员或既有 `X-Admin-Key` 通道，SSE 返回真实记录；只接受 `difficulty: 2 | 3 | 5 | 8`。
- 两组共用同一随机 U/R/F 打乱。每组先调用一次协调模型分配四个策略，再并行调用四个代理；每代理最多六轮，总计最多 50 次模型调用。单请求 30 秒、整轮 120 秒；每次最大输出 512 tokens、输入 JSON 最多 12,000 字符。
- 模型只收到角块状态、U/R/F 置换和扭转规则、自己先前的验证反馈。隐藏打乱和求解器答案不会发给模型。模型返回 `moves` JSON；服务器用 cubing.js 的实际二阶状态验证，禁止任意代码执行。
- 每次候选都从原始状态测试；统计每组走过的不同角块状态。首先验证成功的代理获胜；其余已在途请求继续读取 usage，再结束结算。
- 单进程最多一个实验，北京时间每天最多 20 轮，失败也占额度；断连或停止取消请求。当前部署为单 API 进程；改多实例前必须把锁和额度迁到共享持久存储。
- `data/cube-agents/{latest,quota}.json` 原子保存。每次事件保存进度；进程重启后残留的运行记录显示停止，在途用量标记不完整。可用 `CUBE_AGENTS_DATA_DIR` 指定持久目录，不能放在发布时被清空的构建目录。
- 浏览器不持有供应商密钥，也不自动触发付费调用。复用服务端 `SITE_ASSISTANT_API_KEY` 与北京区 `SITE_ASSISTANT_BASE_URL`；模型白名单在 shared 契约中。未授权模型返回明确的访问错误，不换凭据绕过。

## 用量与价格

费用来自 API 返回的 input/output tokens，不根据耗时或动画估算。包含协调者和四代理，按未扣缓存折扣、免费额度的人民币原价计算；失败或取消且未收到 usage 时显示不完整，不报零费用。页面记录同时保留模型实际 ID，后续更换配置不会给旧结果换标签。

2026-09-28 核对北京区官方价格：Qwen3.7 Flash（`qwen3.7-flash-2026-07-15`）≤32K 输入档每百万输入/输出 ¥0.2/¥0.8；Qwen3.8 Flash（`qwen3.8-flash`）¥0.8/¥2.7。来源：[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)、[Qwen3.8 Flash](https://help.aliyun.com/zh/model-studio/qwen3-8-flash)。变更模型、地区或计费档位必须同时更新这些常量。

## 当前交付证据与阻碍

- API 和页面已在本地实现，尚未发布；现有 localhost 前端默认代理线上 API，因此线上部署新端点之前会提示服务未就绪。
- 在服务器使用现有百炼配置真实调用了同一编排代码：Qwen3.8 Flash 完成 25 次模型调用、24 次验证、90 个不同状态，10.914 秒，15,752 输入 + 530 输出 tokens，估算 ¥0.0140326；本轮 `R U` 未还原。
- Qwen3.7 Flash 返回 HTTP 403 `Access denied by API-Key restrictions.`。第二款模型授权或替代方案仍待维护者确定；不能将当前结果称为成功的两模型对比。
- 原始公开结果保存在 `docs/benchmarks/cube-agents-2026-09-28.json`。这是真实失败记录，不作为默认页面样例或虚构胜利展示。
- API 定向测试验证独立求解校验、50 次调用上限、在途计费、拒绝任意代码、权限、取消、快照恢复；前端测试验证逐次复位、反向定位、中间转角、完整播放短间隔尝试和胜利展开时机。
- 浏览器使用上述真实 JSON 临时替代尚未部署的 GET 响应，检查实际画面和回放、浅深主题、320px 不横向溢出；不等于线上接口或管理员启动流程验收。临时拦截和视口覆盖已撤销。

真实供应商冒烟入口 `core/apps/api/scripts/cube-agents-smoke.ts` 必须显式传 `--run --output=/absolute/path.json`，可附 `--scramble="R U"`；它会产生实际模型费用。无需为了页面回放重复调用模型。

发布仍遵循 AGENTS.md：核对 `deploy_core.yml`（API）、`deploy_next.yml` 和 Vercel（页面）触发范围，分别观察对应提交的 CI、上线健康和实际浏览器结果；不把本地测试或 commit 当成上线证明。
