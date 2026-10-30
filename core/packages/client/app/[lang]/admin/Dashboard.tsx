'use client';

import { useEffect, useRef, useState } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { RefreshCw } from '@app-foundation/icons/lucide';
import type { EChartsCoreOption } from 'echarts/core';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { fetchAdminUsers, type AdminUsersResponse } from '@/lib/account-api';
import { fetchAdminUnreadSubmissions } from '@/lib/alg_api';
import { fetchAdminDashboard, type AdminDashboardData } from '@/lib/admin-dashboard-api';
import '@/components/sticky-table.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type Series = { name: string; data: Array<number | null>; type: 'bar' | 'line' };

// Page-local adapter: domain data and authorization stay outside the chart engine.
export function DashboardChart({ labels, series, label, integer = true }: { labels: string[]; series: Series[]; label: string; integer?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const t = useT();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let cleanup = () => {};
    setFailed(false);
    void Promise.all([import('echarts/core'), import('echarts/charts'), import('echarts/components'), import('echarts/renderers')]).then(([core, charts, components, renderers]) => {
      if (disposed) return;
      core.use([charts.LineChart, charts.BarChart, components.GridComponent, components.LegendComponent, components.TooltipComponent, components.AriaComponent, renderers.SVGRenderer]);
      const chart = core.init(element, undefined, { renderer: 'svg' });
      const paint = () => {
        const style = getComputedStyle(element);
        const color = (token: string) => style.getPropertyValue(token).trim();
        const option: EChartsCoreOption = {
          animation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
          aria: { enabled: true, label: { description: label } },
          color: [color('--accent'), color('--signal-info'), color('--signal-success')],
          textStyle: { color: color('--muted-foreground'), fontFamily: style.fontFamily, fontSize: 14 },
          grid: { left: 12, right: 16, top: 44, bottom: 12, containLabel: true },
          legend: { top: 0, textStyle: { color: color('--muted-foreground'), fontSize: 14 } },
          tooltip: { trigger: 'axis', renderMode: 'richText', backgroundColor: color('--popover'), borderColor: color('--border-default'), textStyle: { color: color('--foreground') } },
          xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: color('--border-default') } }, axisLabel: { hideOverlap: true, color: color('--muted-foreground'), fontSize: 14 } },
          yAxis: { type: 'value', min: 0, minInterval: integer ? 1 : 0, axisLabel: { color: color('--muted-foreground'), fontSize: 14 }, splitLine: { lineStyle: { color: color('--border-default') } } },
          series: series.map(s => ({ ...s, showSymbol: false, barMaxWidth: 28, connectNulls: false })),
        };
        chart.setOption(option, true);
      };
      paint();
      const resize = new ResizeObserver(() => chart.resize());
      resize.observe(element);
      const observer = new MutationObserver(paint);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'data-palette-scheme', 'data-contrast', 'data-appearance-preview'] });
      const media = matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', paint);
      const transition = (event: TransitionEvent) => { if (event.propertyName.startsWith('--')) paint(); };
      document.documentElement.addEventListener('transitionend', transition);
      cleanup = () => { resize.disconnect(); observer.disconnect(); media.removeEventListener('change', paint); document.documentElement.removeEventListener('transitionend', transition); chart.dispose(); };
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; cleanup(); };
  }, [labels, series, label, integer]);
  return <>
    <div ref={host} className="admin-dashboard__chart" role="img" aria-label={label} />
    {failed && <p role="status">{t('图表加载失败，仍可查看数据表。', 'Chart unavailable. The data table is still available.')}</p>}
    <details className="admin-dashboard__table"><summary>{t('查看数据表', 'View data table')}</summary>
      <div className="sticky-scroll admin-dashboard__table-scroll"><table className="sticky-thead"><caption>{label}</caption><thead><tr><th>{t('日期 / 来源', 'Date / source')}</th>{series.map(s => <th key={s.name}>{s.name}</th>)}</tr></thead>
        <tbody>{labels.map((date, index) => <tr key={date}><th>{date}</th>{series.map(s => <td key={s.name}>{s.data[index]?.toLocaleString() ?? '—'}</td>)}</tr>)}</tbody></table></div>
    </details>
  </>;
}

export default function Dashboard() {
  const t = useT();
  const [range, setRange] = useQueryState('days', parseAsStringEnum(['7', '30', '90']).withDefault('30'));
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [currency, setCurrency] = useState('');
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setUsers(null); setData(null); setUnread(null);
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - Number(range) + 1)).toISOString().slice(0, 10);
    void Promise.allSettled([
      fetchAdminUsers({ pageSize: 1, from, to }).then(value => { if (active) setUsers(value); }),
      fetchAdminDashboard(Number(range), controller.signal).then(value => { if (active) setData(value); }),
      fetchAdminUnreadSubmissions().then(value => { if (active) setUnread(value); }),
    ]).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [range, refresh]);

  const unavailable = loading ? <LoadingIndicator /> : t('暂不可用', 'Unavailable');
  const count = (value: number | undefined | null) => value == null ? '—' : value.toLocaleString();
  const cash = (value: number, code: string) => `${code} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const currencies = [...new Set(data?.revenue?.map(row => row.currency) ?? [])];
  const selectedCurrency = currencies.includes(currency) ? currency : currencies[0];
  const revenue = data?.revenue?.filter(row => row.currency === selectedCurrency) ?? [];
  // Refuse unsafe conversion instead of silently rounding financial totals.
  const received = revenue.reduce((sum, row) => sum + BigInt(row.receivedMinor), 0n);
  const refunded = revenue.reduce((sum, row) => sum + BigInt(row.refundedMinor), 0n);
  const precise = received <= BigInt(Number.MAX_SAFE_INTEGER) && refunded <= BigInt(Number.MAX_SAFE_INTEGER);
  const dates = data ? Array.from({ length: Number(range) }, (_, i) => new Date(Date.parse(`${data.from}T00:00:00Z`) + i * 86400_000).toISOString().slice(0, 10)) : [];
  const pending = data?.pending;
  const pendingTotal = pending ? pending.feedback + pending.threads + pending.posts + pending.reports + pending.sponsorClaims : null;
  const traffic = data?.traffic;
  const observed = traffic?.sources.filter(s => s.coverage !== 'not_connected') ?? [];
  const requests = observed.length ? observed.reduce((sum, s) => sum + s.requests, 0) : null;
  const registrations = users?.activity?.registrations;
  const memberships = users?.activity?.memberships;
  const growthDates = registrations?.map(row => row.date) ?? [];
  const todo = [
    { label: t('未完成反馈', 'Open feedback'), value: pending?.feedback, href: '/feedback/admin' },
    { label: t('论坛待审主题与回帖', 'Forum review queue'), value: pending ? pending.threads + pending.posts : null, href: '/forum/review' },
    { label: t('未处理举报', 'Unresolved reports'), value: pending?.reports, href: '/forum/review' },
    { label: t('赞助认领申请', 'Sponsorship claims'), value: pending?.sponsorClaims, href: '/support' },
    { label: t('未读公式投稿', 'Unread algorithm submissions'), value: unread, href: '/account?view=submissions' },
  ];
  return <section className="admin-dashboard" aria-label={t('运营总览', 'Operations overview')} aria-busy={loading}>
    <div className="admin-dashboard__toolbar">
      <div><h2>{t('运营总览', 'Operations overview')}</h2><p>{t('增长与收退款按 UTC 日期统计；今日数据尚未结束。', 'Growth and cash flow use UTC dates; today is still in progress.')}</p></div>
      <label>{t('趋势范围', 'Trend period')} <select className="admin-dashboard-select" aria-label={t('趋势范围', 'Trend period')} value={range} onChange={event => { const value = event.target.value; if (value === '7' || value === '30' || value === '90') void setRange(value); }}>
        <option value="7">{t('最近 7 天', 'Last 7 days')}</option><option value="30">{t('最近 30 天', 'Last 30 days')}</option><option value="90">{t('最近 90 天', 'Last 90 days')}</option>
      </select></label>
      <button type="button" className="admin-boot__refresh" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} />{t('刷新', 'Refresh')}</button>
    </div>
    {!loading && (!users || !data) && <p className="admin-dashboard__notice" role="status">{t('部分统计暂时无法加载，请刷新重试。已显示的数据和管理入口仍可使用。', 'Some statistics could not load. Refresh to retry; available data and management links remain usable.')}</p>}
    <div className="admin-dashboard__metrics">
      <AppLink href="/admin/users" prefetch={false} data-site-surface="panel"><span>{t('累计用户', 'Total users')}</span><strong>{count(users?.summary.totalUsers)}</strong><small>{users ? `${t('今日注册', 'Registered today')} ${count(users.summary.registeredToday)} · UTC` : unavailable}</small></AppLink>
      <AppLink href="/admin/users" prefetch={false} data-site-surface="panel"><span>{t('最近 7 天注册', 'Registrations · last 7 days')}</span><strong>{count(users?.summary.registeredLast7Days)}</strong><small>{users?.membershipSummary ? `${t('有效个人 / 企业会员', 'Active personal / enterprise members')} ${count(users.membershipSummary.activePersonal)} / ${count(users.membershipSummary.activeEnterprise)}` : t('会员统计暂不可用', 'Membership totals unavailable')}</small></AppLink>
      <div data-site-surface="panel"><span>{t('最近完整小时请求', 'Latest complete hour · requests')}</span><strong>{count(requests)}</strong><small>{traffic?.stale ? t('历史快照，报表已过期', 'Historical snapshot · report is stale') : traffic ? t('仅已接入服务器日志，非访客数', 'Connected server logs only, not visitors') : unavailable}</small></div>
      <div data-site-surface="panel"><span>{t('当前待处理', 'Pending now')}</span><strong>{count(pendingTotal)}</strong><small>{t('反馈、论坛审核、举报及赞助认领', 'Feedback, moderation, reports and claims')}</small></div>
    </div>
    <div className="admin-dashboard__grid">
      <section className="admin-dashboard__panel" data-site-surface="panel"><h3>{t('用户增长', 'User growth')}</h3>
        {registrations?.length ? <DashboardChart label={t('每日注册与新增会员', 'Daily registrations and new memberships')} labels={growthDates} series={[
          { name: t('注册', 'Registrations'), type: 'bar', data: registrations.map(row => row.count) },
          ...(memberships ? [{ name: t('个人会员', 'Personal memberships'), type: 'line' as const, data: growthDates.map(date => memberships.find(row => row.date === date)?.personal ?? null) }, { name: t('企业会员', 'Enterprise memberships'), type: 'line' as const, data: growthDates.map(date => memberships.find(row => row.date === date)?.enterprise ?? null) }] : []),
        ]} /> : <p className="admin-dashboard__empty">{unavailable}</p>}
        <AppLink href="/admin/users" prefetch={false}>{t('查看用户与增长', 'View users and growth')}</AppLink>
      </section>
      <section className="admin-dashboard__panel" data-site-surface="panel"><h3>{t('收入 · 订单收退款', 'Revenue · order cash flow')}</h3><p>{t('按实际收款与成功退款日期统计，未扣手续费、分成及拒付，不代表利润。', 'By receipt and successful refund date, before fees, revenue shares and chargebacks. Not profit.')}</p>
        {currencies.length > 0 && <label>{t('币种', 'Currency')} <select className="admin-dashboard-select" aria-label={t('币种', 'Currency')} value={selectedCurrency} onChange={event => setCurrency(event.target.value)}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label>}
        {data?.revenue == null ? <p className="admin-dashboard__empty">{unavailable}</p> : !precise ? <p>{t('金额超出图表安全精度，请查看订单明细。', 'Amounts exceed chart precision. Please review order records.')}</p> : !currencies.length ? <p className="admin-dashboard__empty">{t('所选日期内无收款或成功退款记录。', 'No receipts or successful refunds in this period.')}</p> : <>
          <div className="admin-dashboard__cash"><span>{t('收款', 'Receipts')} <strong>{cash(Number(received) / 100, selectedCurrency)}</strong></span><span>{t('退款', 'Refunds')} <strong>{cash(Number(refunded) / 100, selectedCurrency)}</strong></span></div>
          <DashboardChart integer={false} label={`${t('每日收款与退款', 'Daily receipts and refunds')} · ${selectedCurrency}`} labels={dates} series={[
            { name: `${t('收款', 'Receipts')} (${selectedCurrency})`, type: 'bar', data: dates.map(date => Number(revenue.find(row => row.date === date)?.receivedMinor ?? 0) / 100) },
            { name: `${t('退款', 'Refunds')} (${selectedCurrency})`, type: 'bar', data: dates.map(date => Number(revenue.find(row => row.date === date)?.refundedMinor ?? 0) / 100) },
          ]} />
        </>}
        <h4>{t('累计赞助记录', 'Lifetime sponsorship records')}</h4><p>{t('独立展示，不并入订单收入；现有记录无付款日期，不适用上方日期范围。', 'Shown separately from orders. Records have no payment date, so the period filter does not apply.')}</p>
        {data?.sponsors == null ? <p>{unavailable}</p> : data.sponsors.length ? <div className="admin-dashboard__cash">{data.sponsors.map(row => <strong key={row.currency}>{row.currency} {row.amount}</strong>)}</div> : <p>{t('暂无赞助记录', 'No sponsorship records')}</p>}
        <AppLink href="/support" prefetch={false}>{t('查看赞助记录', 'View sponsorships')}</AppLink>
      </section>
      <section className="admin-dashboard__panel" data-site-surface="panel"><h3>{t('访问量 · 服务器请求', 'Traffic · server requests')}</h3><p>{t('最近一次小时报表，不受趋势范围影响。请求包括静态资源与自动化访问，不等于 PV / UV。Vercel 独立线路未接入。', 'Latest hourly report, independent of the trend period. Includes assets and automated requests; not PV / UV. Vercel-only traffic is not connected.')}</p>
        {traffic ? <>
          <p>{traffic.windowStart.replace('T', ' ').slice(0, 16)} — {traffic.windowEnd.replace('T', ' ').slice(0, 16)} UTC</p>
          {traffic.stale && <p className="admin-dashboard__notice">{t('报表已超过 3 小时未更新，以下为历史快照。', 'Report is over 3 hours old. These are historical counts.')}</p>}
          {observed.length > 0 && <DashboardChart label={t('各入口请求数', 'Requests by entry point')} labels={observed.map(s => ({ nginx: t('主站服务器', 'Main server'), next: t('预览服务器', 'Preview server'), api: 'API', vercel: 'Vercel' })[s.source] ?? s.source)} series={[{ name: t('请求数', 'Requests'), type: 'bar', data: observed.map(s => s.requests) }, { name: t('异常 5xx', 'Unexpected 5xx'), type: 'bar', data: observed.map(s => s.unexpected5xx) }]} />}
          {traffic.sources.filter(s => s.coverage === 'not_connected').map(s => <p key={s.source}>{s.source}: {t('未接入', 'Not connected')}</p>)}
        </> : <p className="admin-dashboard__empty">{loading ? unavailable : t('尚无可用的流量报表，请稍后刷新或查看小时报表。', 'No traffic report available. Refresh later or open the hourly reports.')}</p>}
        <a href="https://github.com/2017YANR02/cuberoot.me/actions/workflows/traffic_monitor.yml" target="_blank" rel="noreferrer">{t('查看小时报表', 'View hourly reports')}</a>
      </section>
      <section className="admin-dashboard__panel" data-site-surface="panel"><h3>{t('待处理事项', 'Items to review')}</h3><p>{t('当前状态，不受日期范围影响；未读投稿不等同于待审核。', 'Current state, independent of the date range. Unread submissions are not an approval queue.')}</p>
        <ul className="admin-dashboard__todos">{todo.map(item => <li key={item.href + item.label}><AppLink href={item.href} prefetch={false}><span>{item.label}</span><strong>{count(item.value)}</strong></AppLink></li>)}</ul>
        {!loading && !pending && <p role="status">{t('待办计数暂不可用，仍可进入各管理页处理。', 'Pending counts unavailable. Management pages remain accessible.')}</p>}
      </section>
    </div>
    {data && <p className="admin-dashboard__updated">{t('汇总更新时间', 'Summary updated')} {data.updatedAt.replace('T', ' ').slice(0, 19)} UTC</p>}
  </section>;
}
