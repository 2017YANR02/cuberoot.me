// Historical observations, not live monitoring. Source: docs/traffic-incident-2026-09-22-25.md.
export const TIMELINE = [
  { date: '09.22', time: 'PDT', zh: '计算器访问量突增', en: 'Calculator traffic spikes', detail: { zh: '全天 Analytics 记录 9,531 次页面浏览。次日抽查发现比赛与选手参数被快速遍历，包含无头浏览器声明。', en: 'Analytics records 9,531 page views for the day. The next day’s sample shows rapid changes in competition and competitor parameters, including a headless-browser claim.' } },
  { date: '09.24', time: '≈ 09:25', zh: '暂停 Vercel 生产访问', en: 'Pause Vercel production', detail: { zh: 'Vercel 生产暂停；自有主站随后上线维护公告。验证、封页与停站也影响了正常读者。', en: 'Vercel production is paused; the self-hosted site later shows a maintenance notice. Challenges, route blocks and downtime also affect legitimate readers.' } },
  { date: '09.24', time: '22:35', zh: '恢复主站，保留计算器限制', en: 'Reopen the site; keep calculator limits', detail: { zh: '恢复两条主站线路，计算器继续拦截。Vercel 的挑战与阿里云的拒绝规则分别保留。', en: 'Both main-site routes reopen, while the calculator remains blocked. Vercel challenges and the self-hosted deny rule remain separate controls.' } },
  { date: '09.24', time: '23:06–23:09', zh: '再次暂停；后续发现预取请求', en: 'Pause again; later identify prefetch requests', detail: { zh: '按要求再次暂停。后续查到部分密集日志标记 Prefetch: Yes；只看时间戳就称为新攻击，证据不足。', en: 'Access is paused again on request. Some dense log sequences later prove to be marked Prefetch: Yes. Timestamps alone did not establish another attack.' } },
  { date: '09.25', time: '00:48 →', zh: '增加详情页和 API 限制', en: 'Add detail-page and API limits', detail: { zh: '加固详情页、比赛代理、独立 API 与公开 next 别名；加入总量上限、参数校验和缓存键规范化。', en: 'Harden detail pages, the competition proxy, the independent API and the public next alias, with aggregate limits, parameter validation and normalized cache keys.' } },
  { date: '09.25', time: '≈ 01:07–01:12', zh: '修复 nginx reload 失败', en: 'Fix the failed nginx reload', detail: { zh: 'nginx 共享区变更使 reload 未生效，旧 worker 继续服务。修复区名并检查新 worker 后，实测封页才返回 403。', en: 'A changed nginx shared-zone key prevents a reload while old workers keep serving. Renaming the zone and verifying new workers finally produces the expected 403.' } },
  { date: '09.25', time: '01:27–01:44', zh: '部署新版本，检查流量', en: 'Deploy and check traffic', detail: { zh: 'Vercel 恢复后确认新生产构建 Ready；阿里云独立观察主站和 API。短窗口未见业务页面 5xx，不能据此保证长期无异常。', en: 'After resuming Vercel, the new production build is verified Ready. Web and API traffic are observed separately on the server. A short window without application-page 5xx is not a long-term guarantee.' } },
  { date: '09.25', time: '≈ 01:58–02:01', zh: '启用分钟监控', en: 'Enable minute checks', detail: { zh: '服务器定时器执行成功。程序在超阈值时切换维护并尝试通知，需人工恢复。此程序不覆盖 Vercel。', en: 'The server timer runs successfully. The guard switches to maintenance at its thresholds and attempts an alert. Reopening is manual; Vercel is not covered.' } },
] as const;

export const FIREWALL_SNAPSHOTS = [
  { window: '09.24 · ≈ 09:13–09:23 PDT', allowed: 7100, denied: 2000, challenged: 8300, approximate: true },
  { window: '09.25 · ≈ 01:44 PDT / 10 min', allowed: 781, denied: 6, challenged: 153, approximate: false },
] as const;

export const REPO = 'https://github.com/2017YANR02/cuberoot.me/blob/main/';
export const ASSETS = '/assets/incidents/2026-09/';
