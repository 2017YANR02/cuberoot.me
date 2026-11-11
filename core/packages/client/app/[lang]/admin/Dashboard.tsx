'use client';

import MoreToggle from '@/components/MoreToggle';
import { useEffect, useRef, useState } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { HelpCircle, RefreshCw } from '@app-foundation/icons/lucide';
import type { EChartsCoreOption } from 'echarts/core';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { fetchAdminUsers, type AdminUsersResponse } from '@/lib/account-api';
import { fetchAdminUnreadSubmissions } from '@/lib/alg_api';
import { fetchAdminDashboard, type AdminDashboardData } from '@/lib/admin-dashboard-api';
import '@/components/sticky-table.css';
import { SkeletonBlock, ContentSkeleton } from '@/components/ContentSkeleton';

type Series = { name: string; data: Array<number | null>; type: 'bar' | 'line' };

// Page-local adapter: domain data and authorization stay outside the chart engine.
export function DashboardChart({ labels, series, label, integer = true, horizontal = false }: { labels: string[]; series: Series[]; label: string; integer?: boolean; horizontal?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const t = useT();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const current = useRef({ labels, series, label, integer, horizontal });
  const repaint = useRef<(() => void) | null>(null);
  useEffect(() => {
    current.current = { labels, series, label, integer, horizontal };
    repaint.current?.();
  }, [labels, series, label, integer, horizontal]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let cleanup = () => {};
    setFailed(false);
    setReady(false);
    void Promise.all([import('echarts/core'), import('echarts/charts'), import('echarts/components'), import('echarts/renderers')]).then(([core, charts, components, renderers]) => {
      if (disposed) return;
      core.use([charts.LineChart, charts.BarChart, components.GridComponent, components.LegendComponent, components.TooltipComponent, components.AriaComponent, renderers.SVGRenderer]);
      const chart = core.init(element, undefined, { renderer: 'svg' });
      let previousOption = '';
      const paint = () => {
        const { labels, series, label, integer, horizontal } = current.current;
        const style = getComputedStyle(element);
        const color = (token: string) => style.getPropertyValue(token).trim();
        const option: EChartsCoreOption = {
          animation: false,
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
        if (horizontal) {
          const valueAxis = option.yAxis;
          option.yAxis = { type: 'category', data: labels, inverse: true, axisLabel: { color: color('--muted-foreground'), fontSize: 13, width: element.clientWidth < 500 ? 90 : 160, overflow: 'truncate' } };
          option.xAxis = valueAxis;
        }
        const signature = JSON.stringify(option);
        if (signature === previousOption) return;
        chart.setOption(option, { replaceMerge: ['series'] });
        previousOption = signature;
      };
      repaint.current = paint;
      paint();
      setReady(true);
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
    return () => { disposed = true; repaint.current = null; cleanup(); };
  }, []);
  return <>
    <div className="admin-dashboard__chart-frame" aria-busy={!ready && !failed}>
      <div ref={host} className="admin-dashboard__chart" role="img" aria-label={label} style={{ visibility: ready ? undefined : 'hidden' }} />
      {!ready && !failed && <SkeletonBlock className="admin-dashboard__chart-overlay" />}
    </div>
    {failed && <p role="status">{t('图表加载失败，仍可查看数据表。', 'Chart unavailable. The data table is still available.')}</p>}
    <details className="admin-dashboard__table"><MoreToggle as="summary">{t('查看数据表', 'View data table')}</MoreToggle>
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
  const [loadedRange, setLoadedRange] = useState(range);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - Number(range) + 1)).toISOString().slice(0, 10);
    void Promise.allSettled([
      fetchAdminUsers({ pageSize: 1, from, to }),
      fetchAdminDashboard(Number(range), controller.signal),
      fetchAdminUnreadSubmissions(),
    ]).then(([usersResult, dashboardResult, unreadResult]) => {
      if (!active) return;
      setUsers(usersResult.status === 'fulfilled' ? usersResult.value : null);
      setData(dashboardResult.status === 'fulfilled' ? dashboardResult.value : null);
      setUnread(unreadResult.status === 'fulfilled' ? unreadResult.value : null);
      setLoadedRange(range);
      setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [range, refresh]);

  const unavailable = loading ? <SkeletonBlock className="admin-dashboard__number-skeleton" /> : t('暂不可用', 'Unavailable');
  const count = (value: number | undefined | null) => value == null ? (loading ? <SkeletonBlock className="admin-dashboard__number-skeleton" /> : '—') : value.toLocaleString();
  const cash = (value: number, code: string) => `${code} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const currencies = [...new Set(data?.revenue?.map(row => row.currency) ?? [])];
  const selectedCurrency = currencies.includes(currency) ? currency : currencies[0];
  const revenue = data?.revenue?.filter(row => row.currency === selectedCurrency) ?? [];
  // Refuse unsafe conversion instead of silently rounding financial totals.
  const received = revenue.reduce((sum, row) => sum + BigInt(row.receivedMinor), 0n);
  const refunded = revenue.reduce((sum, row) => sum + BigInt(row.refundedMinor), 0n);
  const precise = received <= BigInt(Number.MAX_SAFE_INTEGER) && refunded <= BigInt(Number.MAX_SAFE_INTEGER);
  const dates = data ? Array.from({ length: Number(loadedRange) }, (_, i) => new Date(Date.parse(`${data.from}T00:00:00Z`) + i * 86400_000).toISOString().slice(0, 10)) : [];
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
  return <section className="admin-dashboard admin-overview" aria-label={t('运营总览', 'Operations overview')} aria-busy={loading}>
    <div className="admin-dashboard__toolbar">
      <label>{t('趋势范围', 'Trend period')} <select className="admin-dashboard-select" aria-label={t('趋势范围', 'Trend period')} value={range} onChange={event => { const value = event.target.value; if (value === '7' || value === '30' || value === '90') void setRange(value); }}>
        <option value="7">{t('最近 7 天', 'Last 7 days')}</option><option value="30">{t('最近 30 天', 'Last 30 days')}</option><option value="90">{t('最近 90 天', 'Last 90 days')}</option>
      </select></label>
      <button type="button" className="admin-boot__refresh" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} />{t('刷新', 'Refresh')}</button>
    </div>
    {!loading && (!users || !data) && <p className="admin-dashboard__notice" role="status">{t('部分统计暂时无法加载，请刷新重试。已显示的数据和管理入口仍可使用。', 'Some statistics could not load. Refresh to retry; available data and management links remain usable.')}</p>}
    <div className="admin-dashboard__metrics">
      <AppLink href="/admin/users" prefetch={false} data-site-surface="panel"><span>{t('累计用户', 'Total users')}</span><strong>{count(users?.summary.totalUsers)}</strong><small>{users ? `${t('今日注册', 'Registered today')} ${count(users.summary.registeredToday)}` : unavailable}</small></AppLink>
      <AppLink href="/admin/users" prefetch={false} data-site-surface="panel"><span>{t(`最近 ${loadedRange} 天注册`, `Registrations · last ${loadedRange} days`)}</span><strong>{count(registrations?.reduce((sum, row) => sum + row.count, 0))}</strong></AppLink>
      <div data-site-surface="panel"><span>{t('小时请求', 'Hourly requests')} <InfoTooltip icon={HelpCircle} iconSize={15} ariaLabel={t('请求统计说明', 'About request counts')} content={t('最近完整小时内已接入服务器的请求，含静态资源及自动化访问，不代表访客数。', 'Requests from connected servers in the latest complete hour, including assets and automated traffic; not visitor counts.')} /></span><strong>{count(requests)}</strong><small>{traffic?.stale ? t('历史快照，报表已过期', 'Historical snapshot · report is stale') : traffic ? null : unavailable}</small></div>
      <div data-site-surface="panel"><span>{t('待处理', 'Pending')} <InfoTooltip icon={HelpCircle} iconSize={15} ariaLabel={t('待办统计说明', 'About pending counts')} content={t('反馈、论坛审核、举报及赞助认领；不含未读公式投稿。', 'Feedback, moderation, reports and sponsorship claims; excludes unread algorithm submissions.')} /></span><strong>{count(pendingTotal)}</strong></div>
    </div>
    <div className="admin-dashboard__grid">
      <section className="admin-dashboard__panel" data-site-surface="panel"><h3>{t('用户增长', 'User growth')} <InfoTooltip icon={HelpCircle} iconSize={15} ariaLabel={t('会员统计', 'Membership totals')} content={users?.membershipSummary ? t('当前有效会员：个人 ' + count(users.membershipSummary.activePersonal) + '，企业 ' + count(users.membershipSummary.activeEnterprise), 'Currently active members: personal ' + count(users.membershipSummary.activePersonal) + ', enterprise ' + count(users.membershipSummary.activeEnterprise)) : t('会员统计暂不可用', 'Membership totals unavailable')} /></h3>
        {registrations?.length ? <DashboardChart label={t('每日注册与新增会员', 'Daily registrations and new memberships')} labels={growthDates} series={[
          { name: t('注册', 'Registrations'), type: 'bar', data: registrations.map(row => row.count) },
          ...(memberships ? [{ name: t('个人会员', 'Personal memberships'), type: 'line' as const, data: growthDates.map(date => memberships.find(row => row.date === date)?.personal ?? null) }, { name: t('企业会员', 'Enterprise memberships'), type: 'line' as const, data: growthDates.map(date => memberships.find(row => row.date === date)?.enterprise ?? null) }] : []),
        ]} /> : loading && !users ? <SkeletonBlock className="admin-dashboard__chart admin-dashboard__chart-placeholder" /> : <p className="admin-dashboard__empty">{unavailable}</p>}
        <AppLink href="/admin/users" prefetch={false}>{t('查看用户与增长', 'View users and growth')}</AppLink>
      </section>
      <section className="admin-dashboard__panel" data-site-surface="panel"><h3>{t('服务器请求', 'Server requests')} <InfoTooltip icon={HelpCircle} iconSize={15} ariaLabel={t('统计说明', 'About these metrics')} content={t('最近一次小时报表，不受趋势范围影响。请求包括静态资源与自动化访问，不等于 PV / UV。Vercel 独立线路未接入。', 'Latest hourly report, independent of the trend period. Includes assets and automated requests; not PV / UV. Vercel-only traffic is not connected.')} /></h3>
        {traffic ? <>
          {traffic.stale && <p className="admin-dashboard__notice">{t('报表已超过 3 小时未更新，以下为历史快照。', 'Report is over 3 hours old. These are historical counts.')}</p>}
          {observed.length > 0 && <DashboardChart label={t('各入口请求数', 'Requests by entry point')} labels={observed.map(s => ({ nginx: t('主站服务器', 'Main server'), next: t('预览服务器', 'Preview server'), api: 'API', vercel: 'Vercel' })[s.source] ?? s.source)} series={[{ name: t('请求数', 'Requests'), type: 'bar', data: observed.map(s => s.requests) }, { name: t('异常 5xx', 'Unexpected 5xx'), type: 'bar', data: observed.map(s => s.unexpected5xx) }]} />}

        </> : loading ? <SkeletonBlock className="admin-dashboard__chart admin-dashboard__chart-placeholder" /> : <p className="admin-dashboard__empty">{ t('尚无可用的流量报表，请稍后刷新或查看小时报表。', 'No traffic report available. Refresh later or open the hourly reports.')}</p>}
        <details className="admin-overview__disclosure"><MoreToggle as="summary">{t('报表与覆盖范围', 'Report and coverage')}</MoreToggle>{traffic && <>          <p>{traffic.windowStart.replace('T', ' ').slice(0, 16)} — {traffic.windowEnd.replace('T', ' ').slice(0, 16)} UTC</p>          {traffic.sources.filter(s => s.coverage === 'not_connected').map(s => <p key={s.source}>{s.source}: {t('未接入', 'Not connected')}</p>)}</>}<a href="https://github.com/2017YANR02/cuberoot.me/actions/workflows/traffic_monitor.yml" target="_blank" rel="noreferrer">{t('查看小时报表', 'View hourly reports')}</a></details>
      </section>
      <section className="admin-dashboard__panel" data-site-surface="panel"><h3>{t('订单收退款', 'Order cash flow')} <InfoTooltip icon={HelpCircle} iconSize={15} ariaLabel={t('统计说明', 'About these metrics')} content={t('按实际收款与成功退款日期统计，未扣手续费、分成及拒付，不代表利润。', 'By receipt and successful refund date, before fees, revenue shares and chargebacks. Not profit.')} /></h3>
        {currencies.length > 0 && <label>{t('币种', 'Currency')} <select className="admin-dashboard-select" aria-label={t('币种', 'Currency')} value={selectedCurrency} onChange={event => setCurrency(event.target.value)}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label>}
        {data?.revenue == null ? loading ? <SkeletonBlock className="admin-dashboard__chart admin-dashboard__chart-placeholder" /> : <p className="admin-dashboard__empty">{unavailable}</p> : !precise ? <p>{t('金额超出图表安全精度，请查看订单明细。', 'Amounts exceed chart precision. Please review order records.')}</p> : !currencies.length ? <p className="admin-dashboard__empty">{t('本期无收退款', 'No cash flow this period')}</p> : <>
          <div className="admin-dashboard__cash"><span>{t('收款', 'Receipts')} <strong>{cash(Number(received) / 100, selectedCurrency)}</strong></span><span>{t('退款', 'Refunds')} <strong>{cash(Number(refunded) / 100, selectedCurrency)}</strong></span></div>
          <DashboardChart integer={false} label={`${t('每日收款与退款', 'Daily receipts and refunds')} · ${selectedCurrency}`} labels={dates} series={[
            { name: `${t('收款', 'Receipts')} (${selectedCurrency})`, type: 'bar', data: dates.map(date => Number(revenue.find(row => row.date === date)?.receivedMinor ?? 0) / 100) },
            { name: `${t('退款', 'Refunds')} (${selectedCurrency})`, type: 'bar', data: dates.map(date => Number(revenue.find(row => row.date === date)?.refundedMinor ?? 0) / 100) },
          ]} />
        </>}
        <details className="admin-overview__disclosure"><MoreToggle as="summary">{t('累计赞助', 'Lifetime sponsorships')}</MoreToggle><p>{t('独立展示，不并入订单收入；现有记录无付款日期，不适用上方日期范围。', 'Shown separately from orders. Records have no payment date, so the period filter does not apply.')}</p>
        {data?.sponsors == null ? <p>{unavailable}</p> : data.sponsors.length ? <div className="admin-dashboard__cash">{data.sponsors.map(row => <strong key={row.currency}>{row.currency} {row.amount}</strong>)}</div> : <p>{t('暂无赞助记录', 'No sponsorship records')}</p>}
        <AppLink href="/support" prefetch={false}>{t('查看赞助记录', 'View sponsorships')}</AppLink></details>
      </section>
      <section className="admin-dashboard__panel" data-site-surface="panel"><h3>{t('待处理事项', 'Items to review')} <InfoTooltip icon={HelpCircle} iconSize={15} ariaLabel={t('统计说明', 'About these metrics')} content={t('当前状态，不受日期范围影响；未读投稿不等同于待审核。', 'Current state, independent of the date range. Unread submissions are not an approval queue.')} /></h3>
        {loading && !pending && <ContentSkeleton variant="text" />}
        <ul className="admin-dashboard__todos">{todo.filter(item => item.value != null && item.value > 0).map(item => <li key={item.href + item.label}><AppLink href={item.href} prefetch={false}><span>{item.label}</span><strong>{count(item.value)}</strong></AppLink></li>)}</ul>
        {todo.every(item => item.value === 0) && <p>{t('暂无待办', 'No pending items')}</p>}
        <details className="admin-overview__disclosure"><MoreToggle as="summary">{t('其他队列', 'Other queues')}</MoreToggle><ul className="admin-dashboard__todos">{todo.filter(item => item.value == null || item.value === 0).map(item => <li key={item.href + item.label}><AppLink href={item.href} prefetch={false}><span>{item.label}</span><strong>{count(item.value)}</strong></AppLink></li>)}</ul></details>
        {!loading && !pending && <p role="status">{t('待办计数暂不可用，仍可进入各管理页处理。', 'Pending counts unavailable. Management pages remain accessible.')}</p>}
      </section>
    </div>
  </section>;
}
