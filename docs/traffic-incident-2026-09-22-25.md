# 2026-09-22—25 流量事件记录

阅读页：`/zh/dev/traffic-incident-2026-09`（英文 `/dev/traffic-incident-2026-09`）。记录截至 2026-09-25。Analytics 截图取于 10:01 UTC，规则截图取于 09:38 UTC。截图时未改变平台设置。

## 事件与访问影响

9 月 22 日，计算器页面出现流量突增。抽样请求快速更换比赛、选手和轮次参数，部分声明使用无头浏览器，支持“自动化遍历链接”的判断。9 月 24—25 日我们临时限制计算器、暂停和恢复两条生产线路，并加入限流、缓存保护和服务器自动停站。

处置期间，正常用户也可能遇到验证、403 拒绝或 503 维护页。日志支持自动化访问的判断，但无法确认操作者、恶意请求占比或是否发生数据泄露。后来的一批密集请求被查明来自网页预取，相关纠正见 E2。

## 原始证据与截图

### E1：9 月 22 日计算器曲线

- 数据窗口：2026-09-22，Vercel 仪表盘 America/Los_Angeles（PDT，UTC−7）；筛选 `/zh/calc`，Production。
- 9,268 Visitors、9,531 Page Views、95% Bounce Rate。Visitors 是 Analytics 的统计标识，不是已核验的自然人数。Analytics 也可能由阿里云线路页面上报，不能直接当作 Vercel 页面线路流量。
- 2026-09-25 10:01:28 UTC 重新打开同一历史窗口，界面显示以上数值。截图保留完整视口；侧栏和在线人数为截图时状态，不属于 9 月 22 日统计。
- 图片：[Vercel 历史曲线](../core/packages/client/public/assets/incidents/2026-09/vercel-analytics-sep22-v2.png)。
- 图片修订：首版 PNG 的曲线和时间轴挤在左侧，页面直接使用了该文件。9 月 25 日重截完整视口，更换为 v2 地址，并检查保存的文件与页面显示。v1 留作修订记录，不再用于正文。
- [历史查询](https://vercel.com/cube-root/cuberoot-me/analytics?filter=%7B%22path%22%3A%7B%22values%22%3A%5B%22%2Fzh%2Fcalc%22%5D%2C%22operator%22%3A%22eq%22%7D%7D&from=1790060400&to=1790146740&client_type=client_name&page_type=hostname)，需项目权限。

### E2：请求抽样与判断纠正

9 月 22 日 20:00–23:59 PDT 的计算器筛选约 7,000 条请求，与全天 Analytics 不是同一指标或窗口。连续 15 条样本均带比赛及选手参数，其中 1 条声明 `Lightpanda/1.0`，其余声明常见浏览器。样本支持自动化迹象，不能外推整个流量的机器人占比。完整查询参数、来源 IP 与 UA 不公开。

9 月 24 日约 23:05 PDT 的部分预测章节、公式页日志，后续详情抽查标记 `Prefetch: Yes`，含 `_rsc`，来源为站内上级页。源码中的 Next.js Link 预取可以解释这个序列。因此“每秒很多行，所以又遭攻击”的推断证据不足。用户随后要求暂停，暂停的授权与技术归因是两回事。

`bingbot/2.0` 只是客户端声明。应通过 Bing 官方验证工具或正反向 DNS 验证身份；即使是真实爬虫，也需评估请求频率与成本。不能仅凭国家、云厂商、JA4 或浏览器名字断言恶意。

### E3：防护规则截图

2026-09-25 09:38:18 UTC 实际控制台显示：计算器临时 Deny；计算器和比赛 API 单 IP 限流；比赛及选手详情超额 Challenge；Bot Protection 为 Challenge；AI Bots 为 Deny。截图只证明当时配置处于相应状态，不证明命中率或永久有效。

图片：[Vercel 规则](../core/packages/client/public/assets/incidents/2026-09/vercel-firewall-rules-sep25-v1.png)。截取内容区域，不含个人账户、访客 IP、令牌与浏览器书签。未点击启用、禁用或发布按钮。

## 时间线

本表统一 PDT（UTC−7），避免把用户截屏文件时间、平台报表时间和服务器 UTC 混为一谈。首行是观测日期，其他为操作记录。

| 时间 | 发生了什么 | 证据与限制 |
| --- | --- | --- |
| 09-22 | `/zh/calc` 出现流量突增 | 全天 Analytics；09-23 开始分析。自动化比例、唯一人数未知 |
| 09-24 约 09:25 前 | Vercel 生产暂停；此前启用挑战和临时规则 | 生产别名实测 `503 DEPLOYMENT_PAUSED`；独立入口不由此关闭 |
| 09-24 09:36–09:49 | 自有主站维护公告上线；境外 DNS 曾短暂转向阿里云，随后撤回 | 境外恢复 Vercel；DNS 缓存不能即时清空 |
| 09-24 22:35 | 两条主站线路短暂恢复，计算器继续拦截 | 阿里云 `/zh` 200；Vercel Resume 确认；挑战仍保留 |
| 09-24 23:06–23:09 | 按要求再次暂停 | 主站维护 503 / Vercel 暂停 503；不能由日志密度证明新攻击 |
| 09-25 00:48 起 | 详情页限制、独立 API 总量限制、缓存键和代理参数校验加固 | 公开 next 别名补齐；部署通过后仍需实测 |
| 09-25 约 01:07–01:12 | 修复 nginx 共享区变更导致 reload 未生效 | CI 曾成功但旧 worker 仍在；改区名并检查新 worker 后实测 403 |
| 09-25 约 01:27–01:34 | 受控恢复；Vercel 新生产构建 Ready | 暂停期间 Blocked 不等于已上线；需核对实际生产提交 |
| 09-25 01:34–01:44 | 分入口观察恢复窗口 | 自有主站 1,503 请求，独立 API 1,541；Vercel 另有十分钟快照 |
| 09-25 约 01:58–02:01 | 自有服务器分钟守护程序实际执行成功 | 定时器 enabled/active；无触发理由；未在生产人为制造超阈值停站 |

详细发布与 HTTP 证据见 [防护记录](traffic-defense.md)。

## 数字口径

| 数据 | 窗口 | 能说明什么 |
| --- | --- | --- |
| Vercel Allowed ≈7,100 / Denied ≈2,000 / Challenged ≈8,300 | 09-24 约 09:13–09:23 PDT | 请求/规则动作快照，非累计事件总量、人数或拦截率 |
| Vercel Allowed 781 / Denied 6 / Challenged 153 | 09-25 约 01:44 PDT 的十分钟 live 窗口 | 恢复初期的另一份快照；与前者不能构成严格效果对照 |
| 主站 nginx 1,503，其中 `/_next/` 1,125，其他 378 | 09-25 08:34–08:44 UTC | 74.9% 为该路径静态资源请求；“其他”不等于页面浏览 |
| 独立 API 1,541；无 429 / 5xx | 同上 | API 请求，不是另一组独立用户，不能和网页去重相加 |

请求（HTTP）、页面浏览（浏览器事件）、会话、独立 IP 和自然人是不同指标。一个页面会请求脚本、图片、数据与预取内容；多个人可能共用出口 IP，一个人也可能换 IP。没有同一窗口的完整来源集合，就不能把“400 个 IP”宣称为全站去重 IP 数，也不能把“15,000 次请求”换算为确定的访客人数。本记录不提供无数据支撑的国家访客排名。

## 防护设计与代价

1. Vercel：平台 DDoS 缓解、浏览器挑战、路径拒绝及单 IP 限流。Challenge 是验证流程，不等同于成功阻断。已验证爬虫可能跳过 Attack Mode；它有期限，应检查剩余时间。
2. 自有 nginx：主站、公开 next 别名和独立 API 各自入口受限；单 IP 限流之外，还限制高成本路径总量及 API 并发。Vercel 规则不覆盖这些入口。
3. 应用：校验比赛代理参数、规范缓存键、复用已有缓存及相同回源合并、限制合作爬虫遍历参数链接。robots 不是访问控制。
4. 费用：停用 Analytics；保留当时 $10 额外用量预算与自动暂停。固定套餐与已发生费用仍存在，预算检查有延迟，不能保证精确账单硬上限。没有购买新的监控服务。
5. 自动响应：服务器每分钟第 15 秒读取最近两个完整分钟；极高的单分钟或持续两分钟超阈值，切主站维护页、next/API 503，并尝试 Bark 通知；不会自行重开。

守护程序初始阈值与恢复步骤以 [traffic-monitor.md](traffic-monitor.md) 和 [traffic-guard.ts](../core/scripts/traffic-guard.ts) 为准。此保护按请求量及错误判断，不识别人类或机器人，真实热门流量也可能触发。扫描日志尾部有 32 MiB/文件上限，无法承诺无漏报；服务器本身不可用时本地守护也无法运行。

**覆盖缺口：本地自动停站不覆盖 Vercel-only 请求。** Vercel 仍依赖独立平台防护与预算保护；没有实现免费的全站逐请求监控与瞬时自动关闭。分钟检查存在等待与重载时间，不能承诺“异常出现的同一秒停止”。

## 排查中发现的问题

- 检查路径、预取字段、UA 可信度、来源、回源压力和错误率。仅凭日志密集不能确认攻击。
- 配置、部署和生效分别验收：nginx 的 reload 命令返回成功不必然意味着新 worker 接管；Vercel Resume 也不会自动补上曾被 Blocked 的构建。
- 单 IP 限制不足以限制很多来源的合计负担；缓存可减少计算，仍可能产生边缘请求或传输成本。
- 全站挑战、停站和封页会影响正常访问；需检查误拦截，再调整规则。
- 自动化需如实说明覆盖：定时器实跑、判断测试通过，不等于生产端到端紧急停站与通知送达已经演练。

验证记录：[nginx 发布](https://github.com/2017YANR02/cuberoot.me/actions/runs/36115611944)、[守护程序发布](https://github.com/2017YANR02/cuberoot.me/actions/runs/36115800326)、[对应测试通过](https://github.com/2017YANR02/cuberoot.me/actions/runs/36116092475)。本地初次 systemd 执行因 Node 路径失败，已改用服务器实际 Node 路径；后续分钟执行成功。Bark 凭据存在已核实，但未通过生产触发验证消息送达。

## 仍待完成

- 正常用户长窗口、挑战通过率和误拦截复核；据此调整初始阈值。
- Vercel 独立流量的可靠自动观测与暂停方案，需满足用户不新增收费项的约束。
- 在授权的演练窗口验证自动停站、重载后实际 HTTP 状态和告警送达，再验证恢复；不以生产压测冒充日常健康检查。
- 继续审计开发预览域名与其他高成本 API，降低计算器自动取数的负担。

## 公开参考

- [最初证据](traffic-incident-2026-09-22.md)、[完整处置档案](traffic-defense.md)、[监控与恢复手册](traffic-monitor.md)
- [Next.js 预取](https://nextjs.org/docs/app/guides/prefetching)：可解释“点击前出现请求”，不能倒推所有访问正常。
- [Vercel Attack Mode](https://vercel.com/docs/vercel-firewall/attack-mode)、[Spend Management](https://vercel.com/docs/spend-management)
- [验证 Bingbot](https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26)、[Lightpanda 上游](https://github.com/lightpanda-io/browser)
- [WCA robots 源码](https://github.com/thewca/worldcubeassociation.org/blob/main/app/views/static_pages/robots.txt.erb)、[WCA API 限流](https://github.com/thewca/worldcubeassociation.org/blob/main/app/controllers/concerns/api_rate_limiting.rb)、[数据导出说明](https://docs.worldcubeassociation.org/knowledge_base/wca_data_overview)
- [CubingChina 公开仓库](https://github.com/CubingChina/cubingchina)：此前研究发现公开旧栈与线上响应不同；不能据此声称掌握 cubing.com 的线上 WAF 配置。

## 编辑与证据维护

截图取自控制台，不含访客 IP 或凭据。Analytics 使用完整视口截图，避免首版区域截图中的图表变形。时间线、请求示意、线路图和流程图使用 SVG/HTML 绘制。统计图按记录的快照绘制，不补造中间数据。

截图 SHA-256（PNG 原始字节）：

```text
vercel-analytics-sep22-v2.png (正文)
3848061935d437ab2890563a79b0c262f0f2f3609941e9f52deb6ad8de2b3667
vercel-analytics-sep22-v1.png (已停用，图表变形)
a42a5e79d9c8864dd70b1aa522c3674bccbd597f627938e26ec614951ce4da9c
vercel-firewall-rules-sep25-v1.png
9787fec4a147e5899ba7f671487e1daefd0bbd5f751bf29ae91e28517734a104
```

以后新增日志应记录：事件窗口及时间区、用户影响、证据与置信度、处置动作、配置/发布/运行验证、费用口径、判断纠正、剩余风险与待办。保留原结论的纠正历史，不用后来的状态覆盖事发记录。公开页不暴露完整 IP、私人账单明细、查询参数中的个人标识或凭据。
