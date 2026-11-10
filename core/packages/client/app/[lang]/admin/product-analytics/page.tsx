'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { SkeletonBlock } from '@/components/ContentSkeleton';
import { DashboardChart } from '../Dashboard';
import { HelpCircle, RefreshCw } from '@app-foundation/icons/lucide';
import { ANALYTICS_ACTION_FEATURES, type AnalyticsReportAudience, type ProductAnalyticsReport } from '@cuberoot/shared/product-analytics';
import { PAGE_META } from '@cuberoot/shared/page-catalog';
import { listSiteDirectoryEntries, SITE_DIRECTORY_TEXTS } from '@cuberoot/shared/site-directory';
import AppLink from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { fetchProductAnalytics } from '@/lib/product-analytics-api';
import '@/components/sticky-table.css';
import '../admin.css';
import './product-analytics.css';

type View = 'features' | 'pages' | 'entries' | 'frequency';
const featureNames = new Map(listSiteDirectoryEntries().map(entry => [entry.id as string, SITE_DIRECTORY_TEXTS[entry.nameKey]]));
const measuredFeatures = new Set(Object.values(ANALYTICS_ACTION_FEATURES));
const percent = (part: number, total: number) => total > 0 ? `${(part / total * 100).toFixed(1)}%` : '—';

export default function ProductAnalyticsPage() {
  const t = useT();
  const admin = useIsAdmin();
  const user = useAuthUser();
  const owner = user?.uid ?? user?.wcaId;
  const [mounted, setMounted] = useState(false);
  const [days, setDays] = useState(28);
  const [audience, setAudience] = useState<AnalyticsReportAudience>('public');
  const [view, setView] = useState<View>('features');
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<ProductAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setError(false);
    if (!mounted || !admin) return;
    const controller = new AbortController();
    let current = true;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    setLoading(true);
    void fetchProductAnalytics(days, audience, controller.signal).then(result => {
      if (current) setData(result);
    }).catch(() => { if (current) setError(true); }).finally(() => {
      clearTimeout(timeout);
      if (current) setLoading(false);
    });
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [mounted, admin, owner, days, audience, refresh]);

  if (!mounted) return <main className="admin-hub" />;
  if (!admin) return <main className="admin-hub"><h1>{t('产品使用分析', 'Product usage analytics')}</h1>
    <p className="admin-hub__status">{t('只有管理员可以查看统计数据。', 'Only administrators can view analytics.')}</p>
    <AppLink href="/account" prefetch={false}>{t('前往账号页', 'Go to account')}</AppLink></main>;

  const audienceItems: Array<{ value: AnalyticsReportAudience; label: string }> = [
    { value: 'public', label: t('公开用户', 'Public users') },
    { value: 'member', label: t('登录用户', 'Signed-in users') },
    { value: 'anonymous', label: t('匿名会话', 'Anonymous sessions') },
    { value: 'admin', label: t('管理员', 'Administrators') },
  ];
  const viewItems: Array<{ value: View; label: string }> = [
    { value: 'features', label: t('功能总览', 'Feature overview') },
    { value: 'entries', label: t('入口曝光与点击', 'Entry impressions and clicks') },
    { value: 'pages', label: t('页面使用', 'Page usage') },
    { value: 'frequency', label: t('使用频率', 'Usage frequency') },
  ];
  return <main className="admin-hub admin-hub--dashboard product-analytics">
    <header className="admin-hub__heading"><h1>{t('产品使用分析', 'Product usage analytics')} <InfoTooltip icon={HelpCircle} iconSize={18} ariaLabel={t('统计说明', 'About analytics')} content={t('默认统计登录及匿名用户的 Web 活动，匿名会话不等同于独立访客。', 'Web activity is collected by default for signed-in and anonymous users. Anonymous sessions are not unique visitors.')} /></h1></header>
    <section className="admin-dashboard" aria-busy={loading}>
      <div className="admin-dashboard__toolbar">
        <CompactSelect value={days} onChange={setDays} label={t(`最近 ${days} 天`, `Last ${days} days`)} ariaLabel={t('时间范围', 'Period')}
          items={[7, 14, 28, 30].map(value => ({ value, label: t(`最近 ${value} 天`, `Last ${value} days`) }))} />
        <CompactSelect value={audience} onChange={setAudience} items={audienceItems} label={audienceItems.find(item => item.value === audience)!.label} ariaLabel={t('统计人群', 'Audience')} />
        <InfoTooltip icon={HelpCircle} iconSize={15} ariaLabel={t('人群说明', 'About audiences')} content={t('公开用户包含登录账号和匿名会话，排除管理员。匿名会话不能去重为独立访客。', 'Public users include signed-in accounts and anonymous sessions, excluding administrators. Anonymous sessions cannot be deduplicated into unique visitors.')} />
        <button type="button" className="admin-boot__refresh" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} aria-hidden />{t('刷新', 'Refresh')}</button>
      </div>
        {data?.summary.lastEventAt && <p className="admin-dashboard__updated">{t('最新事件（UTC）', 'Latest event (UTC)')}：{data?.summary.lastEventAt.replace('T', ' ').slice(0, 19)}</p>}
      {loading && !data && <div role="status" aria-label={t('正在加载统计…', 'Loading analytics…')}>
        <div className="admin-dashboard__metrics">{Array.from({ length: 4 }, (_, i) => <div key={i} data-site-surface="panel"><SkeletonBlock style={{ width: '45%', height: 22 }} /><strong><SkeletonBlock className="admin-dashboard__number-skeleton" /></strong></div>)}</div>
        <div className="admin-dashboard__toolbar"><SkeletonBlock style={{ width: 240, height: 38 }} /></div>
        <section className="admin-dashboard__panel" data-site-surface="panel"><SkeletonBlock style={{ width: 120, height: 24 }} /><SkeletonBlock className="admin-dashboard__chart admin-dashboard__chart-placeholder" /></section>
      </div>}
      {error && <p role="alert">{t('统计暂时不可用，请稍后刷新。', 'Analytics is unavailable. Refresh to try again.')}</p>}
      {data && <>
        <div className="admin-dashboard__metrics">
          {[[t('统计会话', 'Sessions'), data.summary.sessions], [t('登录账号', 'Signed-in accounts'), data.summary.accountUsers],
            [t('匿名会话', 'Anonymous sessions'), data.summary.anonymousSessions], [t('有效事件', 'Recorded events'), data.summary.events]].map(([label, value]) =>
            <div key={label} data-site-surface="panel"><span>{label}</span><strong>{Number(value).toLocaleString()}</strong></div>)}
        </div>
        {data.summary.events === 0 ? <p className="admin-dashboard__empty">{t('此时间范围内暂无使用数据。', 'No activity in this period.')}</p>
          : <AnalyticsTable key={`${view}:${days}:${audience}:${refresh}`} data={data} view={view} viewControl={<CompactSelect value={view} onChange={setView} items={viewItems} label={viewItems.find(item => item.value === view)!.label} ariaLabel={t('统计视图', 'Report view')} />} />}
        {data.truncated && <p role="status">{t('结果达到 1,000 行上限，请缩短时间范围或筛选人群。', 'Results reached the 1,000-row limit. Narrow the period or audience.')}</p>}

      </>}
      <details className="admin-dashboard__table product-analytics__definitions"><MoreToggle as="summary">{t('指标口径与覆盖范围', 'Definitions and coverage')}</MoreToggle>
        <p>{t('入口曝光要求至少 50% 可见且持续 1 秒；主动点击也计为曝光。同一页面访问内，同一位置的入口只计一次曝光和点击。点击率 = 点击 / 曝光；使用转化率 = 点击后 30 分钟内使用对应功能的次数 / 点击。',
          'An impression requires at least 50% visibility for one second; a deliberate click also establishes exposure. Each entry position is counted once per page view. CTR = clicks / impressions. Use conversion = matched clicks followed by feature use within 30 minutes / clicks.')}</p>
        <p>{t('交互会话表示在页面内容区使用指针或键盘，不包含导航点击；不等同于完成操作。有效阅读要求页面可见 30 秒且有真实交互。使用率 = 使用功能的会话 / 访问会话。当前功能事件覆盖计时完成、主动重新生成打乱、批量求解结果、模拟器操作、公式播放和 NxN 复盘播放；未接入的功能显示“—”。同一操作类型在一次页面访问内只计一次，不表示复原把数或转动次数。',
          'Interaction sessions include pointer or keyboard activity within page content, excluding navigation clicks; they do not imply completed operations. Engaged reading requires 30 visible seconds and interaction. Usage rate = sessions using a feature / visiting sessions. Instrumented actions cover completed solves, requested scramble regeneration, batch solver results, simulator moves, algorithm playback and NxN reconstruction playback. Uninstrumented features show “—”. Each action is counted once per page view, not once per solve or turn.')}</p>
        <p>{t('跨日频率仅统计执行过上述功能操作的登录账号，按 UTC 计算。默认排除管理员、开发环境和嵌入页面；只保留最近 30 天有效事件。浏览器隐私信号、拦截及丢包会影响覆盖，低点击率不能单独证明功能不重要。',
          'Cross-day frequency covers signed-in accounts performing those actions, using UTC dates. Administrators, development environments and embedded pages are excluded by default. Events remain valid for 30 days. Browser privacy signals, blocking and delivery affect coverage; a low CTR alone does not establish low importance.')}</p>
      </details>
    </section>
  </main>;
}

function AnalyticsTable({ data, view, viewControl }: { data: ProductAnalyticsReport; view: View; viewControl: ReactNode }) {
  const t = useT();
  const [sort, setSort] = useState('volume');
  const [page, setPage] = useState(0);
  const featureName = (id: string) => { const label = featureNames.get(id); return label ? t(label.zh, label.en) : id; };
  const deviceName = (device: string) => device === 'mobile' ? t('窄屏', 'Narrow screen') : t('宽屏', 'Wide screen');
  const placementNames: Record<string, string> = { main: t('常用', 'Main'), wca: 'WCA', train: t('训练', 'Training'), tool: t('工具', 'Tools'), learn: t('学习', 'Learning'), other: t('其他', 'Other'), header: t('日历', 'Calendar'), search: t('搜索', 'Search') };
  let headers: string[];
  let rows: Array<{ key: string; chartLabel: string; volume: number; rate: number; cells: ReactNode[] }>;
  if (view === 'features') {
    if (!data.features) return <><div className="admin-dashboard__toolbar">{viewControl}</div><p role="status">{t('统计服务尚未更新，功能总览将在服务端部署后可用。', 'The analytics service has not been updated. Feature overview will be available after the server deployment.')}</p></>;
    headers = [t('功能', 'Feature'), 'PV', t('访问会话', 'Visiting sessions'), t('交互会话', 'Interaction sessions'), t('交互率', 'Interaction rate'), t('完成操作会话', 'Completed-operation sessions')];
    rows = data.features.map(row => ({ key: row.feature, chartLabel: featureName(row.feature), volume: row.sessions, rate: row.sessions ? row.interactingSessions / row.sessions : 0,
      cells: [featureName(row.feature), row.views, row.sessions, row.interactingSessions, percent(row.interactingSessions, row.sessions), measuredFeatures.has(row.feature) ? row.usingSessions : '—'] }));
  } else if (view === 'pages') {
    headers = [t('页面', 'Page'), t('屏幕', 'Screen'), t('语言', 'Language'), 'PV', t('会话', 'Sessions'), t('有效阅读率', 'Engaged rate'), t('交互会话', 'Interaction sessions'), t('使用会话', 'Using sessions'), t('使用率', 'Usage rate')];
    rows = data.pages.map(row => {
      const title = PAGE_META[row.route.slice(1)]?.title;
      const measured = measuredFeatures.has(row.feature);
      return { key: `${row.route}:${row.device}:${row.language}`, chartLabel: `${title ? t(title.zh, title.en) : featureName(row.feature)} · ${deviceName(row.device)} · ${row.language}`, volume: row.views, rate: measured && row.sessions ? row.usingSessions / row.sessions : -1,
        cells: [<span key="page">{title ? t(title.zh, title.en) : featureName(row.feature)}<small>{row.route}</small></span>, deviceName(row.device), row.language === 'zh' ? t('中文', 'Chinese') : 'English', row.views, row.sessions,
          percent(row.engagedSessions, row.sessions), row.interactingSessions, measured ? row.usingSessions : '—', measured ? percent(row.usingSessions, row.sessions) : '—'] };
    });
  } else if (view === 'entries') {
    headers = [t('入口', 'Entry'), t('位置', 'Placement'), t('屏幕', 'Screen'), t('曝光', 'Impressions'), t('点击', 'Clicks'), t('点击率', 'CTR'), t('使用转化', 'Uses after click'), t('转化率', 'Conversion')];
    rows = data.entries.map(row => ({ key: `${row.entry}:${row.placement}:${row.position}:${row.device}:${row.layout}`, chartLabel: `${featureName(row.entry)} · ${placementNames[row.placement] ?? row.placement} ${Number(row.position) + 1} · ${deviceName(row.device)} · ${row.layout}`, volume: row.impressions, rate: row.impressions ? row.clicks / row.impressions : -1,
      cells: [<span key="entry">{featureName(row.entry)}<small>{row.layout}</small></span>, `${placementNames[row.placement] ?? row.placement} · ${Number(row.position) + 1}`, deviceName(row.device), row.impressions, row.clicks, percent(row.clicks, row.impressions),
        measuredFeatures.has(row.entry) ? row.usedAfterClick : '—', measuredFeatures.has(row.entry) ? percent(row.usedAfterClick, row.clicks) : '—'] }));
  } else {
    headers = [t('功能', 'Feature'), t('使用账号', 'Using accounts'), t('人均活跃天数', 'Active days per account'), t('人均使用会话', 'Using sessions per account')];
    rows = data.frequency.map(row => ({ key: row.feature, chartLabel: featureName(row.feature), volume: row.users, rate: row.activeDaysPerUser,
      cells: [featureName(row.feature), row.users, row.activeDaysPerUser.toFixed(2), row.sessionsPerUser.toFixed(2)] }));
  }
  rows.sort((a, b) => (sort === 'rate' ? b.rate - a.rate : b.volume - a.volume) || a.key.localeCompare(b.key));
  const last = Math.max(0, Math.ceil(rows.length / 50) - 1);
  const current = Math.min(page, last);
  if (!rows.length) return <><div className="admin-dashboard__toolbar">{viewControl}</div><p className="admin-dashboard__empty">{view === 'frequency' ? t('没有可计算频率的登录账号操作。', 'No signed-in feature activity to calculate frequency.') : t('此视图暂无数据。', 'No data in this view.')}</p></>;
  const metric = sort === 'rate'
    ? view === 'frequency' ? t('人均活跃天数', 'Active days per account') : view === 'features' ? t('交互率（%）', 'Interaction rate (%)') : view === 'pages' ? t('使用率（%）', 'Usage rate (%)') : t('点击率（%）', 'CTR (%)')
    : view === 'entries' ? t('曝光', 'Impressions') : view === 'pages' ? 'PV' : view === 'features' ? t('访问会话', 'Visiting sessions') : t('使用账号', 'Using accounts');
  const ranked = rows.filter(row => sort !== 'rate' || row.rate >= 0).slice(0, 10);
  return <div className="admin-dashboard__table">
    <div className="admin-dashboard__toolbar">{viewControl}<CompactSelect value={sort} onChange={value => { setSort(value); setPage(0); }} label={sort === 'volume' ? t('按数量排序', 'Sort by volume') : t('按比例 / 频率排序', 'Sort by rate / frequency')} ariaLabel={t('排序', 'Sort')} items={[
      { value: 'volume', label: view === 'entries' ? t('曝光量优先', 'Most impressions') : (view === 'pages' || view === 'features') ? t('访问量优先', 'Most views') : t('使用人数优先', 'Most accounts') },
      { value: 'rate', label: view === 'entries' ? t('点击率优先', 'Highest CTR') : view === 'features' ? t('交互率优先', 'Highest interaction rate') : view === 'pages' ? t('使用率优先', 'Highest usage rate') : t('活跃天数优先', 'Most active days') },
    ]} /></div>
    <section className="admin-dashboard__panel" data-site-surface="panel">
      <h3>{metric} <InfoTooltip icon={HelpCircle} iconSize={15} ariaLabel={t('图表说明', 'About this chart')} content={t('展示当前排序的前 10 项；完整记录见下方明细。比例不能直接相加，未接入功能操作统计的项目不参与使用率排名。', 'Shows the top 10 items in the current sort; all records are in the details below. Rates are not additive. Items without feature-action instrumentation are excluded from usage-rate rankings.')} /></h3>
      {ranked.length ? <DashboardChart horizontal label={metric} integer={sort === 'volume'} labels={ranked.map(row => row.chartLabel)} series={[{ name: metric, type: 'bar', data: ranked.map(row => sort === 'volume' ? row.volume : row.rate * (view === 'frequency' ? 1 : 100)) }]} /> : <p>{t('暂无可排名数据', 'No ranking data')}</p>}
    </section>
    <details className="product-analytics__details"><MoreToggle as="summary">{t('查看完整明细', 'View full details')}</MoreToggle>
    <div className="sticky-scroll product-analytics__scroll"><table className="sticky-thead"><thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
      <tbody>{rows.slice(current * 50, (current + 1) * 50).map(row => <tr key={row.key}>{row.cells.map((value, index) => index === 0 ? <th key={index} scope="row">{value}</th> : <td key={index}>{typeof value === 'number' ? value.toLocaleString() : value}</td>)}</tr>)}</tbody></table></div>
    {last > 0 && <div className="product-analytics__pagination"><button type="button" className="admin-boot__refresh" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('上一页', 'Previous')}</button>
      <span>{current + 1} / {last + 1}</span><button type="button" className="admin-boot__refresh" disabled={current === last} onClick={() => setPage(current + 1)}>{t('下一页', 'Next')}</button></div>}
    </details>
  </div>;
}
