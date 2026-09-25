# 网络异常流量防护与费用止损

状态记录：2026-09-24 22:35 PDT（2026-09-25 05:35 UTC）。后续操作先重新读取平台状态，不能把本文件当作永久有效的配置。

## 当前结论

**应用户恢复访问的要求，Vercel 生产项目已 Resume，阿里云 nginx 维护开关已关闭。** Vercel 控制台显示 `Project resumed`；阿里云配置由提交 `f47c7890ac` 经 [Deploy Web Ops Config](https://github.com/2017YANR02/cuberoot.me/actions/runs/36099065986) 成功发布。22:35 PDT 直连阿里云 IP、指定 `cuberoot.me` Host/SNI 实测 `/zh` 返回 200、`/` 返回 307 到 `/en`，均不再是维护页。境外 DNS 仍为 Vercel，国内/默认线路仍为阿里云，本次未改 DNS。

用户要求暂时保留拦截：Vercel Attack Mode 和 `Emergency deny /zh/calc during traffic spike` 保持启用；Bot Protection Challenge、AI Bots Deny 和 `/zh/calc`、`/api/comp/` 两条单 IP 限流也保留。阿里云线路新增精确 `/zh/calc` 拒绝，含查询参数的请求实测返回 403；其他页面已开放。Vercel 解除暂停后，命令行 HEAD 请求得到 `x-vercel-mitigated: challenge`，不能据此判断普通浏览器未完成挑战后的页面状态。Attack Mode 约 2026-09-25 08:58 PDT 自动到期，具体以控制台为准；到期不撤销计算器拒绝规则。

团队费用预算仍为额外用量 $10、Pause On；Web Analytics 仍关闭。Vercel WAF 不覆盖阿里云 nginx 或独立 API；阿里云目前仅对 `/zh/calc` 有这次新增的精确拒绝，不能把 Vercel 的全站挑战和单 IP 限流当成阿里云线路的防护。长期防护尚未完成。原事件证据仅支持自动化程序批量遍历比赛及计算器链接，不能证明全部访客都是机器人，不能确定操作者及其目的，也不能断言网站存在数据泄露。

## 停站期间状态（历史）

**当时用户要求停止 Vercel 访问。`cuberoot-me` 生产部署曾暂停。** 控制台显示项目已暂停；09:25 PDT 对 `https://cuberoot-me.vercel.app/` 的实际 HEAD 请求返回 HTTP 503、`x-vercel-error: DEPLOYMENT_PAUSED`。

Vercel 的 Pause Project 仅停止生产部署，预览部署、配置和数据保留。自有服务器 nginx 和独立 API 不受此操作控制；不要描述为整个团队或全部互联网入口已经关闭。

### 09:49 境外转移已撤回；当时国内入口仍是静态维护

**09:48–09:49 PDT 用户担心阿里云承担境外流量，明确要求撤回。已将 `www` 和 `@` 的「境外」A 记录恢复为 Vercel `216.198.79.1`、TTL 30 分钟，www 权重 1 保留。Vercel 未恢复，09:48 实测仍为 `503 DEPLOYMENT_PAUSED`。** 此前指向阿里云的记录 TTL 为 10 分钟，递归 DNS 缓存可能在撤回后一段时间仍导向旧地址；不能宣称流量即时归零。原有国内/默认 A 记录和独立 API、static 等域名没有变更；nginx 的静态维护拦截保留，避免缓存与国内请求重新进入完整 Next 应用。未经新指令不得再次把境外流量转到阿里云。

以下为 09:36–09:43 的历史操作记录，境外 DNS 转移已经按上一段撤回：

用户随后要求主域显示自定义公告。09:36 PDT nginx 发布成功（[运行 36028329042](https://github.com/2017YANR02/cuberoot.me/actions/runs/36028329042)，提交 `8fdd9ab`），09:42 左右浏览器打开 `https://cuberoot.me/` 已实际显示中英文维护公告。文案说明大量异常自动化访问和暂时停站，不断言数据泄露或操作者身份。

- `ops/nginx/00-maintenance.conf` 是维护开关和独立 HTML 的单一来源；当时为 `default 1`。主域全部页面和 Next 代理路径直接返回约 2 KB HTML、HTTP 503、`Retry-After: 600`，不运行 Next、Analytics 或调用 API。证书 ACME 验证路径除外。
- 实测 `/zh/calc` 与 `/api/comp/maintenance-check` 返回 `X-CubeRoot-Maintenance: 2026-09-24`；`www` 返回 308 到裸域。独立 `api`、`static` 和 `next` 域名仍是独立入口，不能宣称全部停机。
- 阿里云 DNS 的 `@` 和 `www` 两条「境外」A 记录均从 `216.198.79.1` 改为 `47.97.30.181`，TTL 从 30 分钟改为 10 分钟；原 `www` 权重 1 保留，其他国内/默认 A 记录原本已指向该自有服务器。两条记录均已在控制台核实保存，Google DNS 查询也返回新 IP、TTL 600。旧缓存可能继续显示 Vercel 暂停页，不能保证所有递归 DNS 同时刷新。
- 09:39 再次实测 `cuberoot-me.vercel.app` 仍返回 `503 DEPLOYMENT_PAUSED`，未恢复 Vercel 项目，也未开通新增付费服务。公告由现有服务器承载，仍会消耗少量服务器带宽，不等于网络流量完全归零。

## 停站期间已执行措施（历史状态）

| 措施 | 已核实状态 | 作用与边界 |
| --- | --- | --- |
| Pause Project | 09:25 前已执行，HTTP 503 实测通过 | 停止 Vercel 生产访问；手动恢复前持续有效，预览部署不受影响 |
| Attack Mode | 约 09-24 08:58 PDT 开启 24 小时 | 浏览器挑战；约 09-25 08:58 PDT 自动到期，具体看控制台剩余时间 |
| Bot Protection | Challenge 已发布 | 对识别的自动化流量发起挑战，不能保证挡住所有浏览器自动化 |
| AI Bots | Deny 已发布 | 拦截平台识别的 AI 爬虫，不代表所有恶意程序 |
| `/zh/calc` 临时封页 | 自定义规则 `Emergency deny /zh/calc during traffic spike`，首条，Deny | 精确匹配路径，包含带查询参数的请求；正常用户也被拒绝；无自动到期，不覆盖 `/calc` |
| `/zh/calc` 单 IP 限流 | 5 次 / 60 秒，固定窗口，429 | Deny 在前时该限流不会继续命中；不是全站总上限 |
| `/api/comp/` 单 IP 限流 | 路径前缀，20 次 / 60 秒，固定窗口，429 | 保护经过 Vercel 的 Next 代理；不保护独立 API 域名和 nginx 入口 |
| Web Analytics | 控制台已显示 disabled | 停止新访客事件采集；不等于阻止网站请求，也不会撤销已有费用 |
| 团队费用保护 | Budget $10、Pause On，已保存核实 | 当前固定套餐 $20，加额外用量预算 $10，对应用户总额 $30 的目标 |

费用预算针对包含额度用完后的额外按量消费。达到预算会暂停团队所有生产项目。Vercel 每隔几分钟检查，可能超过阈值，不能承诺精确 $30 硬封顶。席位、月付附加包、Marketplace、自有服务器等费用不由此预算完整覆盖；AI Gateway 等独立用量也不能靠暂停生产部署全部停止。

截至本轮账单核查：项目 Usage 显示 Infrastructure Subtotal $8.13，其中 Web Analytics Events $4.90；团队 Billing 显示已使用包含额度 $8.91/$20，额外消费 $0，Upcoming Invoice $20。不同页面口径不同，Usage 可延迟一小时，不能说已经额外扣款 $8.13。

## 暂停前的流量快照

来源：[Firewall Traffic](https://vercel.com/cube-root/cuberoot-me/firewall/traffic?range=live)。以下全部是请求或规则动作，不是人数，不是本次事件的累计攻击次数。

| 读取时间与窗口（PDT） | Allowed | Denied | Challenged | Rate Limited |
| --- | ---: | ---: | ---: | --- |
| 约 09:14，近十分钟 | 约 8,300 | 727 | 约 7,600 | — |
| 约 09:23，约 09:13–09:23 | 约 7,100 | 约 2,000 | 约 8,300 | — |

第二个快照中放行较前次约少 14%，但窗口有少量重叠、数据会刷新，不能据此认定异常消失或精确衡量防护效果。Challenged 只表示触发验证，不能与 Denied 相加当作成功阻断数。

同次 live 页的规则/路径分组与顶部计数不一致（临时 Deny 规则约 2.7k），不拿它替代顶部 Denied，也不据此计算拦截率。随后用 Query Builder 固定 **2026-09-24 16:13:10–16:22:20 UTC**，过滤 `WAF Action = ALLOW`、`Request Path = /zh/calc`，返回 **No data in this time range**。这表示该查询窗口未查到计算器放行记录，不是保证所有时间与入口都零绕过。

上述数据均发生在整站暂停前。暂停后的确定证据是生产域名返回 `DEPLOYMENT_PAUSED`，不能把暂停前的 7,100 次放行称为暂停后的流量。

当时最新成功的 nginx [监控运行 36006184476](https://github.com/2017YANR02/cuberoot.me/actions/runs/36006184476) 创建于 2026-09-24 13:30:57 UTC（06:30 PDT）。它不是当前分钟的服务器状态证明。工作流虽配置每小时执行，但实际调度可能延迟；每次先核对 run 时间和报告窗口。

## 三条入口分别检查

### 请求来源国家快照

2026-09-24 约 09:35 PDT 查询 Firewall Query Builder：`Firewall Actions Count Sum`，按 `IP Country` 分组，未筛选动作；窗口从 09-23 09:30 PDT 到查询时（界面结束刻度为 09-24 09:45）。计数包含正常放行、验证、拒绝等动作，**不是独立 IP 数，也不是已确认的攻击次数**。IP 所在国家不代表操作者所在地。

| 国家 | 界面计数（约） |
| --- | ---: |
| 美国 | 142,000 |
| 孟加拉国 | 111,000 |
| 巴西 | 99,000 |
| 印度 | 95,000 |
| 巴基斯坦 | 71,000 |
| 越南 | 51,000 |
| 阿根廷 | 40,000 |
| 南非 | 32,000 |
| 印度尼西亚 | 32,000 |
| 阿联酋 | 23,000 |

### 入口覆盖

1. **Vercel 生产**：Firewall、Logs、Usage；停站期间曾暂停。预览部署另查访问保护，不自动视为关闭。
2. **自有 nginx → Next**：`ops/nginx/www.cuberoot.me.conf`、`/www/wwwlogs/www.cuberoot.me.log` 和现有监控；Vercel WAF 不能替它限流。
3. **独立 API**：`api.cuberoot.me` → Hono。Next `/api/comp/[slug]` 会代理到此处；只限制代理入口不等于独立 API 受保护。

Analytics 是浏览器上报的数据集，不能直接等同于 Vercel 页面线路。源码根 layout 无条件加载 Analytics；nginx 源码将 `/_vercel/insights/` 代理到 Vercel，所以自有线路也可能上报。具体线上覆盖需要核对当次部署脚本及实际 nginx 配置；不得将 nginx 请求数与 Analytics 访客数相加。

## 长期措施清单（尚未实现，不得报已完成）

- [ ] 在真正昂贵的接口处增加共享总请求量和并发上限，并按账号或可靠会话分配个人额度。不能仅在每个 serverless 实例内存中计数来冒充全局限额；匿名 Cookie 可重建，不能单独当安全边界。
- [ ] 核对 Vercel、nginx、独立 API、预览域名的全部入口；避免从旁路绕过限额。参数需校验，缓存键需规范化。
- [ ] 对重复比赛数据复用缓存，合并并发的相同回源；确认实际费用路径后确定额度和 TTL。可变数据浏览器缓存不超过仓库规定，暂态和空结果不得长缓存。
- [ ] 评估把计算器自动获取比赛/选手资料改为用户明确操作，降低只打开页面造成的负担。
- [ ] 补齐 robots 的中文比赛/选手路径和计算器参数 URL 规则，评估成绩链接 nofollow。已有 `prefetch=false`，不能把这次问题直接归为预取故障。robots/nofollow 只约束合作爬虫。
- [ ] 用完整的措施后窗口检查 429、5xx、响应时间、回源次数、计费量和正常用户影响，再决定恢复访问。

单 IP 限流挡不住大量低频 IP 的合计流量。Vercel 限流按区域计数；常见浏览器共享 JA4，不能因一个指纹占比高就认定都是攻击者。也不能仅凭云厂商 IP、国家或浏览器声明封禁大片正常流量。

## 再次发生时的操作顺序

1. 记录时间、项目、入口和费用明细；查看同一窗口的 Firewall Allowed/Denied/Challenged 与错误，不只看访客曲线。
2. 对高成本且明确异常的路径实施临时边缘限制，说明正常用户影响；每次发布后确认规则处于启用状态。
3. 若需要立即停站止损，使用项目 Settings → General → Pause Project，确认项目名后执行；实测生产别名返回 `503 DEPLOYMENT_PAUSED`。不需要删除项目或改 DNS。
4. 检查 Billing → Spend Management 的 Budget 和 Pause；只填预算而 Pause Off 不会自动止损。
5. 需要细查来源时读取现有日志，使用聚合数据；不把原始 IP、完整 UA、敏感查询参数、凭据写入公开仓库，不新增收费 Log Drain 或 Analytics Plus。
6. 每次变更更新本文的状态和时间；规则配置、实际命中和已确认计费分别记账。

## 恢复步骤

2026-09-24 22:35 PDT 已按用户的新指令恢复 Vercel 生产项目及阿里云其他页面；用户要求继续保留临时拦截，计算器页面仍受限。

维护公告已通过将 `ops/nginx/00-maintenance.conf` 的开关改为 `default 0` 并运行 `deploy_nginx.yml` 关闭；境外 DNS 已于 09:48–09:49 恢复原 Vercel 地址。以下保留此次恢复时的操作边界，未来再停站与恢复仍须先核对实时状态。

1. 先完成所需防护并检查实际接口负载。项目 Settings → General → Resume Project 可恢复生产服务，无需重新部署。
2. 如要恢复计算器，还需在 Firewall Rules 单独停用 `Emergency deny /zh/calc during traffic spike` 并发布；Resume 不会自动撤销这条规则。保留或调整已验证的限流。
3. Attack Mode 到期不会自动恢复暂停项目；恢复项目也不等于所有挑战被撤销。逐项核对。
4. Web Analytics 恢复是单独决策，重新启用会恢复事件采集和相应按量计费。
5. 恢复后核对正常浏览器和必要 API，查看完整时间窗口。预算触发暂停后，即使调高预算也需手动恢复项目。

## 参考

- [既有流量监控](traffic-monitor.md)、[09-22 事件证据](traffic-incident-2026-09-22.md)
- [Vercel 暂停项目](https://vercel.com/docs/projects/managing-projects#pausing-a-project)、[费用保护](https://vercel.com/docs/spend-management)
- [Vercel WAF 限流](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)、[WAF 拦截流量计费政策](https://vercel.com/changelog/web-application-firewall-mitigated-traffic-is-free-on-vercel)
- [停用 Web Analytics](https://vercel.com/docs/analytics/using-web-analytics)、[Analytics 价格](https://vercel.com/docs/analytics/limits-and-pricing)
