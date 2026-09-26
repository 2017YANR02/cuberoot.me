# 网络异常流量防护与费用止损

面向普通读者和开发者的完整复盘：[2026-09-22—25 事件日志](traffic-incident-2026-09-22-25.md)，页面 `/zh/dev/traffic-incident-2026-09`；含真实 Vercel 截图、可视化与判断纠正。本文件保留操作细节与历史状态。

2026-09-25 增加阿里云本地 `cuberoot-traffic-guard.timer` 自动止损，规则、恢复方法与 Vercel 覆盖缺口见 [traffic-monitor.md](traffic-monitor.md)。守护程序按分钟检查主站、公开预览和独立 API 的日志；异常时三者进入维护/503，并通过 Bark 告警。Vercel 独立线路仍由其平台防护、WAF 与预算暂停保护，本地守护程序无法代替 Vercel 线路的实时流量判断。

最新恢复记录：2026-09-25 19:20 PDT（2026-09-26 02:20 UTC）。后续操作先重新读取平台状态，不能把本文件当作永久有效的配置。

## 09-26 02:20 UTC 恢复阿里云主站与 API

后续中国大陆 IP 豁免：按用户要求为 CN 来源配置流量豁免。阿里云以连接 IP 匹配 [DB-IP Country Lite](https://db-ip.com/db/download/ip-to-country-lite) 的 IPv4/IPv6 网段，使页面／详情／计算器／比赛代理／比赛数据／独立 API 的限流与并发计数键为空；中文计算器的临时 403 和维护 503 也豁免。CN 请求仍被记录，但不参与自动停站阈值。其他地区与未知归属继续使用原阈值。地理库每月更新、定时检查；不能通过 `X-Forwarded-For` 或国家请求头自行取得豁免。IP 归属可能有误差，代理回源按连接地址识别，不能保证还原原访客国家。此豁免针对本次流量防护，不改变账号认证、业务写入限制或云平台基础防护。

发布前验证：27 项专项检查通过；线上服务器的隔离 nginx 实例使用新配置，CN IPv4/IPv6 共 720 次测试请求全部为 200；非 CN 的 60 次详情请求为 11 次 200、49 次 429；伪造国家／转发请求头不能绕过计算器 403。隔离维护模式下非 CN 为 503，CN IPv4 计算器与 CN IPv6 比赛 API 均为 200。隔离测试没有调用生产应用。生产发布结果另行记账。

生产确认（2026-09-26 02:51 UTC）：代码 `574a1712b2` 的[守护程序部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/36212650176)及[Test](https://github.com/2017YANR02/cuberoot.me/actions/runs/36212650290)成功。首轮 nginx 发布因 server-if 中的 `add_header` 不被允许而自动回滚；修正 `fe716cdbcc` 经完整服务器配置校验及 [nginx 部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/36212871938)成功，新 worker 接管。四个 nginx 文件与监控、守护程序的线上 SHA-256 均与源码一致。运行时维护开关为 `default 0;`，流量守护及国家网段刷新 timer 均为 active。通过真实中国出口回访阿里云中文计算器和 API 均为 200；计算器访问日志带 `maintenance=0 cn_exempt=1`，外部直连主站亦为 200。

Vercel 同期已发布置顶的 `China mainland traffic exemption`（`rule_china_mainland_traffic_exemption_aOC64j`）：Country Equals CN → Bypass，执行在原有计算器拒绝、限流和 Bot Management 之前，控制台确认发布成功。从杭州服务器强制访问 Vercel 线路的 `/zh/calc` 得到 200。该规则不绕过 Vercel 系统 DDoS 防护、项目暂停或预算暂停；不能宣称中国访客在云平台层面永远无任何限制。[Vercel 官方规则说明](https://vercel.com/docs/vercel-firewall/firewall-concepts)。

用户已自行恢复 Vercel，并要求恢复阿里云。会话网络权限恢复后，通过 SSH 核对 Next 与 API 的本机健康请求均为 200、nginx 配置检查通过、自动停站 timer 为 active。备份运行时状态文件后，将 `/etc/nginx/cuberoot-maintenance-state.conf` 从 `default 1;` 改为 `default 0;`，检查 nginx 配置并 reload。

新 worker 接管后，服务器本机经 HTTPS/SNI 分别访问主站 `/zh`、`next.cuberoot.me/zh`、API `/v1/nav/home-locks` 均为 200；外部关闭本机代理、指定阿里云 IP 验证主站和 API，也均为 200。reload 刚发出时的首组请求仍返回旧 worker 的 503，后续验收确认已切换。没有修改 DNS、限流阈值或自动停站配置；中文计算器临时拒绝仍保留。中国 IP 豁免尚未实施，不能将本次恢复说成中国 IP 不受限制。

02:22:16 UTC 自动守护检查覆盖恢复后的完整 02:21–02:22 UTC 分钟：Web 收到 228 次、API 收到 361 次；API 限流 429 为 4 次，Web 限流为 0；两者维护响应与意外 5xx 均为 0。维护开关仍为关闭，`reasons: []`，随后主站和 API 再次返回 200。该短窗口证明恢复及部分限流命中，不代表后续流量不会变化，也不覆盖 Vercel。

## 09-25 22:34 UTC 再次暂停与小时告警修正

[小时监控运行 36195797022](https://github.com/2017YANR02/cuberoot.me/actions/runs/36195797022)报告的是 21:00–22:00 UTC：主站 187、API 41,384、预览入口 198 次请求。API 原始日志核对为 41,384 次 503，响应正文合计 16,736,708 字节；该时段阿里云已处于维护状态。小时监控原先将这些维护响应统一报成 server_errors_high，文字不能据此证明应用过载。

22:23–22:33 UTC 实测 API 6,000 次请求、1,050 个去重日志来源 IP，全部返回 503。同期读取 Vercel Live 显示约 6,700 次 Allowed。按此前异常时立即停止的授权，约 22:34 UTC 暂停 Vercel 生产项目；控制台显示已暂停，生产别名实测 503 DEPLOYMENT_PAUSED，阿里云继续返回维护 503。此举为费用止损，不是对全部访问者身份的认定。

小时告警修复从 nginx 逐请求维护标记入手。新通知明确统计时段、收到／确认拦截／成功响应数量，拆分维护、429、403；无标记旧 503 保留待核对，非维护服务错误继续报警。20 项监控与守护程序测试通过；独立 nginx 实测维护请求记录 maintenance=1、ACME 例外记录 maintenance=0。发布后的运行结果与日志标记需分别核实。

发布验收：修复提交 `48f31f43d2` 的 [nginx 部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/36198167329)成功；自动停站中文通知补充提交 `12681da848` 的[守护程序部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/36198305618)成功，相关检查共 22 项通过。线上 nginx、监控及守护程序的文件校验值与本地一致，真实 API 日志已带 `maintenance=1`。[小时通知验收运行](https://github.com/2017YANR02/cuberoot.me/actions/runs/36198349331)成功，Bark 返回 code 200；由于其统计 21:00–22:00 UTC 的旧日志，文案明确列出旧 503 待核对，没有猜测历史标记。

2026-09-26 00:00 UTC 又用线上程序读取刚结束的 23:00–24:00 UTC 完整窗口（北京时间 07:00–08:00）：主站收到／维护拦截 1,028／1,028 次，API 1,385／1,385 次，预览入口 319／319 次；合计 2,732 次全部有逐请求维护标记，成功响应 0 次。通知标题为「CubeRoot 访问量提醒」，不再误报服务器故障。此统计仍不覆盖 Vercel。全量客户端 CI 另有复盘与公式相关测试失败，不能把专项检查及部署成功说成全量 CI 通过。

## 09-25 页面总量保护与停站判断调整

阿里云主域与 `next.cuberoot.me` 的页面请求共用一个固定计数键，跨 IP、语言和 nginx worker 合计按 `600r/m` 持续速率限制，允许 30 次突发。比赛／选手详情及比赛子页继续受原有 `5r/s`、突发 30 的较低总速率约束，同时保留每 IP 限流。超额返回 429，额度随时间恢复，不需要重开网站。

这些是 nginx 漏桶速率，不是固定或滚动 60 秒的精确总数上限。页面预算排除已知静态资源后缀、`/_next`、`/_vercel`、`/api`、`/v1`、`/tools`、`/stats` 和独立博客入口；页面路径上的 RSC／预取仍计数。API 保留自己的限流。此配置不覆盖 Vercel 页面，也没有跨两条线路共享计数；未引入付费监控、共享计数数据库或新的流量代理。

自动守护程序保留 429 统计，但取消 `api_429_spike` 停站条件，并从请求总量停站判断中扣除 429。连续两分钟的页面紧急阈值由 350 调到 800，留出页面限流的突发空间；单分钟 1,000、非 429 请求量及真实 5xx 保护继续保留。维护期间明确输出 `maintenance: true`，不把维护页自身的 503 再判为新故障。限流不判断访问者身份，配额耗尽仍会影响正常访客。

发布前验证：守护程序与日志监控的 14 项检查通过。服务器独立 loopback nginx 实例中，70 个不同测试 IP 的页面请求跨两个监听入口共享额度，31 次返回 200、39 次返回 429；10 个静态／接口排除路径全部返回 200，等待 4.1 秒后页面恢复 200；比赛子页也命中总量限制。测试没有调用生产 Next 或 API。维护开关保持现状，不因发布自动恢复。

发布确认：提交 `9158c402b9` 已推送；[nginx 部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/36195024413)与[守护程序部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/36195024418)成功。nginx 于 22:07:49 UTC 确认启动新 worker，三个 nginx 文件及守护程序的线上 SHA-256 与本地一致。22:08 UTC 守护程序实测为 `maintenance: true`、`reasons: []`；22:09 UTC 绕过本机代理直连阿里云，主站返回维护 503。全量客户端 CI 另行运行，不把部署成功视为全量测试通过。

## 09-25 20:37 UTC 自动停站与比赛子页限流

20:35、20:36 UTC 独立 API 分别收到 1,419、1,057 次请求，其中 184、138 次返回 429。322 次 429 全部来自 `/v1/cubing-live/:slug`：251 次命中单 IP 限额，71 次命中比赛 API 总量限额。20:37:16 UTC，本地守护程序因 `api_429_spike` 将维护开关设为 `default 1;`。这是限流次数触发，不能直接等同于服务器过载或已确认的攻击。

同一窗口的比赛接口有 506 次 `node` 请求，涉及 379 场比赛、410 个不同请求路径及参数组合。Vercel 日志已对上 SwedishChampionship2011 的页面访问、`/api/comp/` 代理及返回 429 的阿里云回源链路。仓库 GitHub Actions 在流量上升至停站的窗口内没有任务运行；`node` 不能据此归因为 CI。非 `node` API 请求另有 388 个去重日志 IP，不等于人数或攻击者数量。

原 nginx 和 Vercel 详情页规则以比赛 slug 结尾，遗漏 `/result/...` 等子页。本次将比赛详情及全部子路径纳入原计数桶，英文与中文合并计数，仍保留比赛列表、`stats`、`sources` 页面；选手详情原范围不变。

- Vercel：每 IP 每 60 秒 30 次，超额 Challenge；控制台已确认发布成功。比赛代理 `/api/comp/` 原有每 IP 每 60 秒 20 次、超额 429 的规则继续保留。计数按 Vercel 区域执行，不是跨区域总量上限，也不能阻止大量 IP 各自低频访问。
- nginx：原共享区每 IP 30 次／分钟、突发 10，以及总量 5 次／秒、突发 30，新增覆盖比赛子页，超额 429。主域与 `next.cuberoot.me` 共用计数。提交 `dc753e48f9` 的 [Deploy Web Ops Config](https://github.com/2017YANR02/cuberoot.me/actions/runs/36193190977) 于 21:46:33 UTC 成功完成；线上已读到新表达式，nginx 新 worker 于 21:46:23 UTC 启动，主站仍实测为维护 503。
- 验证：服务器独立 loopback nginx 实例通过 6 个受限路径和 8 个排除路径检查，连续子页请求实际出现 429；未对生产应用做压力测试。

本次不恢复维护开关，也不修改自动停站阈值。Vercel Attack Mode 在本次读取时已到期（控制台显示 Enable），Bot Protection 和 AI Bots 规则仍启用。未添加付费监控服务。

## 09-25 受控恢复与初始观察

用户授权恢复访问，并要求流量再异常时立即停站。提交 `35aa69d8ac` 经 [Deploy Web Ops Config](https://github.com/2017YANR02/cuberoot.me/actions/runs/36112690515) 成功部署；直连阿里云主站 `/zh` 返回 200，`/zh/calc` 继续返回 403。Vercel 控制台于约 01:27 PDT 确认 `Project resumed`。暂停期间的 Blocked 构建不能直接 Redeploy；实际恢复后推送的提交 `8c62bcde6a` 已于 08:33:54 UTC 构建为 Ready，Deployment 详情的 Current Domains 包含 `cuberoot.me`，因此此前的 robots 与比赛代理校验已经进入 Vercel 当前生产代码。命令行访问 Vercel 入口仍得到 Challenge，不能用 curl 的状态码替代真人完成挑战后的页面验收。

08:34–08:44 UTC 自有主站 nginx 记录 1,503 次请求，其中 1,125 次为 `/_next/` 静态资源，比赛／选手详情 12 次，最高完整一分钟 271 次；48 次 403、14 次 502，后者全部是停用 Analytics 后仍代理 `/_vercel/insights/script.js` 的外部连接失败，未见 Next 页面 5xx。独立 API 同窗口 1,541 次请求，最高完整一分钟 223 次，无 429 或 5xx；约 19.6 MiB 响应量包含论坛视频分段下载。约 08:44 UTC 的 Vercel Firewall Live 十分钟窗口显示 781 Allowed、6 Denied、153 Challenged。这些是请求或动作，不是人数；阿里云与 Vercel 窗口可能有边界偏差，不能相加当全站独立访问量。

初始窗口未见高成本路径或业务回源错误异常，主站保持开放；费用报表存在延迟，本轮未用它判断新增账单。Attack Mode、Bot Protection、AI Bots、计算器拒绝、单 IP 限流、$10 超额预算暂停和停用 Analytics 的状态保持原样。Attack Mode 控制台当时约剩 7 小时 14 分，届时会自动到期；费用预算不是逐请求硬断路器。若后续发现持续异常，应立即 Pause Vercel 项目并将阿里云维护开关恢复为 `default 1`，分别验证生产别名 `DEPLOYMENT_PAUSED` 与阿里云主站维护 503。当前自动 Traffic Monitor 仍按小时运行，且 `vercel:not_connected`；本次人工分钟级观察不能承诺无人值守期间也能立即发现并自动停站。

## 09-25 防护加固

**主站仍暂停。** 00:48 PDT 已在 Vercel Firewall 发布两项调整：新增中英文比赛与选手详情路径的单 IP 30 次／60 秒限流，超额发起 Challenge（比赛统计与来源说明页除外）；原计算器 5 次／60 秒、超额 429 的规则扩展到 `/calc` 和 `/zh/calc`。原 `/zh/calc` Deny 排在限流之前，仍继续拒绝该路径。控制台显示规则启用并提示发布成功；由于生产项目暂停，尚不能用恢复后的真实流量证明命中率或正常用户影响。Attack Mode、Bot Protection、AI Bots、`/api/comp/` 规则和预算设置未在此次调整中更改。

本次仓库变更给自有 nginx 的比赛／选手详情、计算器、`/api/comp/` 代理、独立 `/v1/cubing-live/:slug` 设置分路径单 IP 与跨 IP 总量上限，并给独立 API 全站设置 30 次／秒、允许 100 次突发的保护；比赛数据接口另限制并发 20。`/api/comp/` 和 `/v1/cubing-live/` 缓存键按有效参数规范化，保留响应版本 `v`。Next 比赛代理在回源前拒绝未知、重复或畸形查询参数；`robots.txt` 补齐 `/zh` 详情路径，并禁止计算器的带参数 URL 被合作爬虫抓取。这些仓库变更的线上生效状态以对应提交的部署结果和实测为准。

提交 `52bafaee57` 的 [nginx 配置部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/36109806721)、[Next 部署](https://github.com/2017YANR02/cuberoot.me/actions/runs/36109806719)和[测试](https://github.com/2017YANR02/cuberoot.me/actions/runs/36109806706)均成功。线上 nginx 配置哈希与仓库一致、`nginx -t` 通过；`next.cuberoot.me/robots.txt` 已含中英文新规则，非法比赛代理查询返回 400。阿里云主站仍为维护 503，Vercel 生产别名仍为 `DEPLOYMENT_PAUSED` 503，独立 API 普通请求返回 200。以上只证明配置发布和基础健康；限流实际命中及恢复后的正常用户影响尚待开放窗口观察。

Vercel 的[新 Web 提交](https://vercel.com/cube-root/cuberoot-me/7rHLrAmHw2RnG3aZEYNtCCz7PmnN)显示 `Deployment Blocked`，页面明确说明项目暂停导致无法构建；当前 Production Deployment 仍指向旧提交 `548aa0f8f5`。因此防火墙规则已经发布，但新的 robots 与比赛代理校验**尚未部署到 Vercel 生产**。恢复 Vercel 时必须先处理这个构建差异，不能把 GitHub push 或阿里云 Next 部署成功当作 Vercel 已更新。

后续监控变更使现有 [Traffic Monitor](traffic-monitor.md) 同时覆盖公开 `next.cuberoot.me` 和独立 API 的 nginx 日志，分别报告 API 的 429、5xx 与请求量突增；该监控不新增 Vercel Log Drain 或恢复 Web Analytics，也不能替代 Vercel Firewall 的实时窗口。

`next.cuberoot.me` 直达与主域相同的 Next 服务。本次补充让它复用主域的详情、计算器和 `/api/comp/` 限流共享区，并对 `/zh/calc` 返回 403；否则攻击者可绕开主域规则直接消耗同一后端。其他开发预览域名仍须按各自入口审计。

初次发布共享区时，[工作流 36111033832](https://github.com/2017YANR02/cuberoot.me/actions/runs/36111033832)虽然显示成功，实测 `next.cuberoot.me/zh/calc` 仍是 200；nginx error log 的 08:07 UTC `emerg` 说明同名共享区改了计数键，master 拒绝 reload，旧 worker 仍在运行。提交 `e044c598d9` 给变更了键的共享区更名，并让部署工作流确认新 worker 启动，未启动时回滚并报失败。[修复部署 36111530482](https://github.com/2017YANR02/cuberoot.me/actions/runs/36111530482)成功后，直连实测预览域名 `/zh/calc` 为 403、`/zh` 为 200，主域仍为维护 503，独立 API 普通请求为 200。最近 8 分钟日志抽查中 API 有 284 次请求、无 429 或 5xx；这只是短窗口验收，不代表未来不会误限流。

[手动监控运行 36110433177](https://github.com/2017YANR02/cuberoot.me/actions/runs/36110433177)成功，完整 06:00–07:00 UTC 窗口分别报告主站 nginx 5,055 次请求、独立 API 7,330 次请求，Vercel 标明 `not_connected`。这些是不同入口的请求数，不是访客数，不能相加推断独立用户。

[加入公开预览入口后的监控运行 36111796838](https://github.com/2017YANR02/cuberoot.me/actions/runs/36111796838)也成功，完整 07:00–08:00 UTC 窗口分别标明主站 nginx 1,428、`next` 238、独立 API 2,837 次请求，Vercel 仍为 `not_connected`。该窗口早于最新 nginx reload，不能作为新限流阈值命中效果的证明。

初始阈值来自阿里云线路的短暂开放窗口及独立 API 日志：比赛与选手详情合计最高约 69 次／分钟，直播比赛数据约 7 次／分钟；API 全站最高 81 次／秒、10 秒内 241 次。按日志秒级回放，API 30 次／秒、100 次突发未模拟出拒绝；该回放不能代替真实 nginx 毫秒级执行，也没有覆盖 Vercel 请求。恢复后需观察 429、Challenge、5xx、回源率和真实用户反馈，再调整阈值。主站不能仅因配置已发布就自动恢复。

### 对照 WCA 与粗饼公开证据

- [WCA robots 源码](https://github.com/thewca/worldcubeassociation.org/blob/main/app/views/static_pages/robots.txt.erb)限制搜索和带参数的排名／纪录页面；[API 限流源码](https://github.com/thewca/worldcubeassociation.org/blob/main/app/controllers/concerns/api_rate_limiting.rb)在生产环境为来源 IP 设置 60 次／分钟，但 Rails 默认按控制器分桶，不能视为全站总限额。[公开 WCIF 控制器](https://github.com/thewca/worldcubeassociation.org/blob/main/app/controllers/api/v0/competitions_controller.rb)使用 ETag、Last-Modified、短时 HTTP 缓存和对象缓存。[官方数据文档](https://docs.worldcubeassociation.org/knowledge_base/wca_data_overview)引导大批量使用者获取定期导出。公开源码无法证明 WCA 当前托管层的全部 WAF 规则。
- 2026-09-25 实测 `cubing.com` 响应表明它使用阿里云 ESA：比赛页为 `X-Site-Cache-Status: DYNAMIC`，静态资源可在边缘 HIT；[ESA 文档](https://www.alibabacloud.com/help/en/edge-security-acceleration/esa/user-guide/default-cache-rule)解释这两个缓存状态。其当前 `robots.txt` 对通用爬虫未禁路径；[公开 CubingChina 仓库](https://github.com/CubingChina/cubingchina/blob/master/README.md)仍是 Yii/PHP，而线上响应显示 Nuxt，不能把仓库里的旧限流或缓存代码当作线上配置。公开响应也不能证明它启用了哪些 WAF／验证码阈值。

## 前次暂停结论（历史）

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
- [ ] 核对 Vercel、nginx、独立 API、预览域名的全部入口；本次已覆盖三个生产入口及公开 `next` 别名的高成本比赛路径，开发预览域名与其他 API 高成本路径仍需审计。比赛代理参数已校验，两个比赛缓存键已规范化。
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

1. 先完成所需防护并检查实际接口负载。当前项目暂停导致新提交的 Vercel 构建被 Blocked；Resume Project 只会先恢复旧 Production Deployment。恢复时先核对 Attack Mode 是否仍有效及防火墙规则，随后为最新 `main` 提交重新触发 Vercel 生产构建，确认 Ready、提交 SHA 与新 robots／代理接口，再考虑对普通访客开放。不能把 Resume 当作自动部署新代码。
2. 如要恢复计算器，还需在 Firewall Rules 单独停用 `Emergency deny /zh/calc during traffic spike` 并发布；Resume 不会自动撤销这条规则。保留或调整已验证的限流。
3. Attack Mode 到期不会自动恢复暂停项目；恢复项目也不等于所有挑战被撤销。逐项核对。
4. Web Analytics 恢复是单独决策，重新启用会恢复事件采集和相应按量计费。
5. 恢复后核对正常浏览器和必要 API，查看完整时间窗口。预算触发暂停后，即使调高预算也需手动恢复项目。

## 参考

- [既有流量监控](traffic-monitor.md)、[09-22 事件证据](traffic-incident-2026-09-22.md)
- [Vercel 暂停项目](https://vercel.com/docs/projects/managing-projects#pausing-a-project)、[费用保护](https://vercel.com/docs/spend-management)
- [Vercel WAF 限流](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)、[WAF 拦截流量计费政策](https://vercel.com/changelog/web-application-firewall-mitigated-traffic-is-free-on-vercel)
- [停用 Web Analytics](https://vercel.com/docs/analytics/using-web-analytics)、[Analytics 价格](https://vercel.com/docs/analytics/limits-and-pricing)
