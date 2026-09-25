# 网络异常流量防护与费用止损

状态记录：2026-09-25 00:58 PDT（2026-09-25 07:58 UTC）。后续操作先重新读取平台状态，不能把本文件当作永久有效的配置。

## 09-25 防护加固

**主站仍暂停。** 00:48 PDT 已在 Vercel Firewall 发布两项调整：新增中英文比赛与选手详情路径的单 IP 30 次／60 秒限流，超额发起 Challenge（比赛统计与来源说明页除外）；原计算器 5 次／60 秒、超额 429 的规则扩展到 `/calc` 和 `/zh/calc`。原 `/zh/calc` Deny 排在限流之前，仍继续拒绝该路径。控制台显示规则启用并提示发布成功；由于生产项目暂停，尚不能用恢复后的真实流量证明命中率或正常用户影响。Attack Mode、Bot Protection、AI Bots、`/api/comp/` 规则和预算设置未在此次调整中更改。

本次仓库变更给自有 nginx 的比赛／选手详情、计算器、`/api/comp/` 代理、独立 `/v1/cubing-live/:slug` 设置分路径单 IP 与跨 IP 总量上限，并给独立 API 全站设置 30 次／秒、允许 100 次突发的保护；比赛数据接口另限制并发 20。`/api/comp/` 和 `/v1/cubing-live/` 缓存键按有效参数规范化，保留响应版本 `v`。Next 比赛代理在回源前拒绝未知、重复或畸形查询参数；`robots.txt` 补齐 `/zh` 详情路径，并禁止计算器的带参数 URL 被合作爬虫抓取。这些仓库变更的线上生效状态以对应提交的部署结果和实测为准。

提交 `52bafaee57` 的 [nginx 配置部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/36109806721)、[Next 部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/36109806719)和[测试](https://github.com/2017YANR02/cuberoot.me/actions/runs/36109806706)均成功。线上 nginx 配置哈希与仓库一致、`nginx -t` 通过；`next.cuberoot.me/robots.txt` 已含中英文新规则，非法比赛代理查询返回 400。阿里云主站仍为维护 503，Vercel 生产别名仍为 `DEPLOYMENT_PAUSED` 503，独立 API 普通请求返回 200。以上只证明配置发布和基础健康；限流实际命中及恢复后的正常用户影响尚待开放窗口观察。

后续监控变更使现有 [Traffic Monitor](traffic-monitor.md) 同时覆盖独立 API 的 nginx 日志，分别报告 API 的 429、5xx 与请求量突增；该监控不新增 Vercel Log Drain 或恢复 Web Analytics，也不能替代 Vercel Firewall 的实时窗口。

初始阈值来自阿里云线路的短暂开放窗口及独立 API 日志：比赛与选手详情合计最高约 69 次／分钟，直播比赛数据约 7 次／分钟；API 全站最高 81 次／秒、10 秒内 241 次。按日志秒级回放，API 30 次／秒、100 次突发未模拟出拒绝；该回放不能代替真实 nginx 毫秒级执行，也没有覆盖 Vercel 请求。恢复后需观察 429、Challenge、5xx、回源率和真实用户反馈，再调整阈值。主站不能仅因配置已发布就自动恢复。

### 对照 WCA 与粗饼公开证据

- [WCA robots 源码](https://github.com/thewca/worldcubeassociation.org/blob/main/app/views/static_pages/robots.txt.erb)限制搜索和带参数的排名／纪录页面；[API 限流源码](https://github.com/thewca/worldcubeassociation.org/blob/main/app/controllers/concerns/api_rate_limiting.rb)在生产环境为来源 IP 设置 60 次／分钟，但 Rails 默认按控制器分桶，不能视为全站总限额。[公开 WCIF 控制器](https://github.com/thewca/worldcubeassociation.org/blob/main/app/controllers/api/v0/competitions_controller.rb)使用 ETag、Last-Modified、短时 HTTP 缓存和对象缓存。[官方数据文档](https://docs.worldcubeassociation.org/knowledge_base/wca_data_overview)引导大批量使用者获取定期导出。公开源码无法证明 WCA 当前托管层的全部 WAF 规则。
- 2026-09-25 实测 `cubing.com` 响应表明它使用阿里云 ESA：比赛页为 `X-Site-Cache-Status: DYNAMIC`，静态资源可在边缘 HIT；[ESA 文档](https://www.alibabacloud.com/help/en/edge-security-acceleration/esa/user-guide/default-cache-rule)解释这两个缓存状态。其当前 `robots.txt` 对通用爬虫未禁路径；[公开 CubingChina 仓库](https://github.com/CubingChina/cubingchina/blob/master/README.md)仍是 Yii/PHP，而线上响应显示 Nuxt，不能把仓库里的旧限流或缓存代码当作线上配置。公开响应也不能证明它启用了哪些 WAF／验证码阈值。

## 当前结论

**用户要求再次禁止主站访问。Vercel `cuberoot-me` 生产项目已重新 Pause；阿里云 nginx 维护开关已重新开启。** Vercel 控制台显示 `Project paused`，23:09 PDT 对 `cuberoot-me.vercel.app` 和公网 `cuberoot.me` 的同类页面请求均返回 `503 DEPLOYMENT_PAUSED`。提交 `82f96a3e06` 经 [Deploy Web Ops Config](https://github.com/2017YANR02/cuberoot.me/actions/runs/36101396673) 成功发布；23:08 PDT 直连阿里云 IP 请求 `/zh` 返回 503 和 `X-CubeRoot-Maintenance: 2026-09-24`。DNS 未更改：境外仍指向 Vercel，国内/默认线路仍指向阿里云。独立 `api`、`static`、`next` 域名和预览部署不由这两个暂停操作关闭。

**短暂开放期间有密集请求，但不能仅凭日志行频率判定异常或攻击。** 约 23:05 PDT 的 Vercel [Logs](https://vercel.com/cube-root/cuberoot-me/logs) 显示 `/wca/prediction/333/*`、`/zh/alg/3x3/vls` 等路径的连续 200 请求；随后抽查的章节和公式页请求详情均标记 `Prefetch: Yes`，带 `_rsc` 参数，Referer 指向站内上级页面。源码中相应页面使用未禁预取的 Next.js `Link`，可解释一个页面加载后出现多个后台请求。先前将这一序列直接称作异常遍历，证据不足。23:09 刷新时最新一行仍为 23:05:44，早于约 23:06 的暂停。暂停前读取的 Firewall Live 十分钟窗口约有 939 Allowed、125 Challenged、8 Denied；这是请求/规则动作数，不是人数，也不能仅凭这组数据确认操作者。阿里云现有 [Traffic Monitor 运行](https://github.com/2017YANR02/cuberoot.me/actions/runs/36101419183) 报告的是 **05:00–06:00 UTC 完整上一小时**：nginx 13,033 次请求、1,173 个页面候选、同小时七日基线 768、355 次 5xx，报警阈值未触发；它不覆盖 06:00 后刚关闭前的阿里云流量，也不覆盖 Vercel。

Vercel Attack Mode、计算器拒绝规则、Bot Protection、AI Bots 和两条单 IP 限流仍保留；Web Analytics 仍关闭，团队额外用量预算 $10、Pause On 仍保留。暂停后仍可能有请求到达边缘或进入日志，当前已实证的是上述生产页面不再返回应用内容；不能把“仍有访问尝试”当成“生产部署仍在服务”。

## 22:35 短暂恢复窗口（历史）

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

## 长期措施清单

- [x] 在独立 API 的 nginx 入口增加共享总请求量与比赛数据并发上限；单 IP 和跨 IP 限额均在 nginx shared zone 计数，不依赖 serverless 实例内存。若未来要按账号分配个人额度，需另行设计可信身份与数据层计数；匿名 Cookie 可重建，不能单独当安全边界。
- [ ] 核对 Vercel、nginx、独立 API、预览域名的全部入口；本次已覆盖三个生产入口的高成本比赛路径，预览域名与其他 API 高成本路径仍需审计。比赛代理参数已校验，两个比赛缓存键已规范化。
- [x] 已有重复比赛数据缓存与并发相同回源合并；本次规范化 nginx 缓存键，保留版本号。需在恢复后复核实际回源率与费用路径。可变数据浏览器缓存不超过仓库规定，暂态和空结果不得长缓存。
- [ ] 评估把计算器自动获取比赛/选手资料改为用户明确操作，降低只打开页面造成的负担。
- [x] 补齐 robots 的中文比赛/选手路径和计算器参数 URL 规则。成绩链接是否需要 nofollow 尚未决定；已有 `prefetch=false`，不能把这次问题直接归为预取故障。robots/nofollow 只约束合作爬虫。
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

2026-09-24 22:35 PDT 曾短暂恢复 Vercel 生产项目及阿里云其他页面；约 23:06–23:08 又按用户的新指令暂停。用户要求继续保留临时拦截。

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
