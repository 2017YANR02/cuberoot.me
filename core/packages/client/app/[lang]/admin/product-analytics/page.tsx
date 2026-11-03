'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw } from '@app-foundation/icons/lucide';
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

type View = 'pages' | 'entries' | 'frequency';
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
  const [view, setView] = useState<View>('entries');
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<ProductAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setData(null); setError(false);
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
    { value: 'public', label: t('公开用户（排除管理员）', 'Public users (excluding admins)') },
    { value: 'member', label: t('登录用户', 'Signed-in users') },
    { value: 'anonymous', label: t('匿名会话', 'Anonymous sessions') },
    { value: 'admin', label: t('管理员', 'Administrators') },
  ];
  const viewItems: Array<{ value: View; label: string }> = [
    { value: 'entries', label: t('入口曝光与点击', 'Entry impressions and clicks') },
    { value: 'pages', label: t('页面使用', 'Page usage') },
    { value: 'frequency', label: t('使用频率', 'Usage frequency') },
  ];
  return <main className="admin-hub admin-hub--dashboard product-analytics">
    <header className="admin-hub__heading"><h1>{t('产品使用分析', 'Product usage analytics')}</h1>
      <p>{t('仅包含主动授权的 Web 使用数据，匿名会话不等同于独立访客。', 'Includes opted-in Web activity only. Anonymous sessions are not unique visitors.')}</p></header>
    <section className="admin-dashboard" aria-busy={loading}>
      <div className="admin-dashboard__toolbar">
        <CompactSelect value={days} onChange={setDays} label={t(`最近 ${days} 天`, `Last ${days} days`)} ariaLabel={t('时间范围', 'Period')}
          items={[7, 14, 28, 30].map(value => ({ value, label: t(`最近 ${value} 天`, `Last ${value} days`) }))} />
        <CompactSelect value={audience} onChange={setAudience} items={audienceItems} label={audienceItems.find(item => item.value === audience)!.label} ariaLabel={t('统计人群', 'Audience')} />
        <button type="button" className="admin-boot__refresh" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} aria-hidden />{t('刷新', 'Refresh')}</button>
      </div>
      {loading && <p role="status">{t('正在加载统计…', 'Loading analytics…')}</p>}
      {error && <p role="alert">{t('统计暂时不可用，请稍后刷新。', 'Analytics is unavailable. Refresh to try again.')}</p>}
      {data && <>
        <div className="admin-dashboard__metrics">
          {[[t('统计会话', 'Sessions'), data.summary.sessions], [t('登录账号', 'Signed-in accounts'), data.summary.accountUsers],
            [t('匿名会话', 'Anonymous sessions'), data.summary.anonymousSessions], [t('有效事件', 'Recorded events'), data.summary.events]].map(([label, value]) =>
            <div key={label} data-site-surface="panel"><span>{label}</span><strong>{Number(value).toLocaleString()}</strong></div>)}
        </div>
        <div className="admin-dashboard__toolbar">
          <CompactSelect value={view} onChange={setView} items={viewItems} label={viewItems.find(item => item.value === view)!.label} ariaLabel={t('统计视图', 'Report view')} />
        </div>
        {data.summary.events === 0 ? <p className="admin-dashboard__empty">{t('此时间范围内暂无已授权的使用数据。', 'No opted-in activity in this period.')}</p>
          : <AnalyticsTable key={`${view}:${days}:${audience}:${refresh}`} data={data} view={view} />}
        {data.truncated && <p role="status">{t('结果达到 1,000 行上限，请缩短时间范围或筛选人群。', 'Results reached the 1,000-row limit. Narrow the period or audience.')}</p>}
        {data.summary.lastEventAt && <p className="admin-dashboard__updated">{t('最新事件（UTC）', 'Latest event (UTC)')}：{data.summary.lastEventAt.replace('T', ' ').slice(0, 19)}</p>}
      </>}
      <details className="admin-dashboard__table product-analytics__definitions"><MoreToggle as="summary">{t('指标口径与覆盖范围', 'Definitions and coverage')}</MoreToggle>
        <p>{t('入口曝光要求至少 50% 可见且持续 1 秒；主动点击也计为曝光。同一页面访问内，同一位置的入口只计一次曝光和点击。点击率 = 点击 / 曝光；使用转化率 = 点击后 30 分钟内使用对应功能的次数 / 点击。',
          'An impression requires at least 50% visibility for one second; a deliberate click also establishes exposure. Each entry position is counted once per page view. CTR = clicks / impressions. Use conversion = matched clicks followed by feature use within 30 minutes / clicks.')}</p>
        <p>{t('有效阅读要求页面可见 30 秒且有真实交互。使用率 = 使用功能的会话 / 访问会话。当前功能事件覆盖计时完成、主动重新生成打乱、批量求解结果、模拟器操作、公式播放和 NxN 复盘播放；未接入的功能显示“—”。同一操作类型在一次页面访问内只计一次，不表示复原把数或转动次数。',
          'Engaged reading requires 30 visible seconds and interaction. Usage rate = sessions using a feature / visiting sessions. Instrumented actions cover completed solves, requested scramble regeneration, batch solver results, simulator moves, algorithm playback and NxN reconstruction playback. Uninstrumented features show “—”. Each action is counted once per page view, not once per solve or turn.')}</p>
        <p>{t('跨日频率仅统计执行过上述功能操作的登录账号，按 UTC 计算。默认排除管理员、开发环境和嵌入页面；只保留最近 30 天有效事件。统计存在授权与丢包偏差，低点击率不能单独证明功能不重要。',
          'Cross-day frequency covers signed-in accounts performing those actions, using UTC dates. Administrators, development environments and embedded pages are excluded by default. Events remain valid for 30 days. Consent and delivery affect coverage; a low CTR alone does not establish low importance.')}</p>
      </details>
    </section>
  </main>;
}

function AnalyticsTable({ data, view }: { data: ProductAnalyticsReport; view: View }) {
  const t = useT();
  const [sort, setSort] = useState('volume');
  const [page, setPage] = useState(0);
  const featureName = (id: string) => { const label = featureNames.get(id); return label ? t(label.zh, label.en) : id; };
  const deviceName = (device: string) => device === 'mobile' ? t('窄屏', 'Narrow screen') : t('宽屏', 'Wide screen');
  const placementNames: Record<string, string> = { main: t('常用', 'Main'), wca: 'WCA', train: t('训练', 'Training'), tool: t('工具', 'Tools'), learn: t('学习', 'Learning'), other: t('其他', 'Other'), header: t('日历', 'Calendar'), search: t('搜索', 'Search') };
  let headers: string[];
  let rows: Array<{ key: string; volume: number; rate: number; cells: ReactNode[] }>;
  if (view === 'pages') {
    headers = [t('页面', 'Page'), t('屏幕', 'Screen'), t('语言', 'Language'), 'PV', t('会话', 'Sessions'), t('有效阅读率', 'Engaged rate'), t('使用会话', 'Using sessions'), t('使用率', 'Usage rate')];
    rows = data.pages.map(row => {
      const title = PAGE_META[row.route.slice(1)]?.title;
      const measured = measuredFeatures.has(row.feature);
      return { key: `${row.route}:${row.device}:${row.language}`, volume: row.views, rate: measured && row.sessions ? row.usingSessions / row.sessions : -1,
        cells: [<span key="page">{title ? t(title.zh, title.en) : featureName(row.feature)}<small>{row.route}</small></span>, deviceName(row.device), row.language === 'zh' ? t('中文', 'Chinese') : 'English', row.views, row.sessions,
          percent(row.engagedSessions, row.sessions), measured ? row.usingSessions : '—', measured ? percent(row.usingSessions, row.sessions) : '—'] };
    });
  } else if (view === 'entries') {
    headers = [t('入口', 'Entry'), t('位置', 'Placement'), t('屏幕', 'Screen'), t('曝光', 'Impressions'), t('点击', 'Clicks'), t('点击率', 'CTR'), t('使用转化', 'Uses after click'), t('转化率', 'Conversion')];
    rows = data.entries.map(row => ({ key: `${row.entry}:${row.placement}:${row.position}:${row.device}:${row.layout}`, volume: row.impressions, rate: row.impressions ? row.clicks / row.impressions : -1,
      cells: [<span key="entry">{featureName(row.entry)}<small>{row.layout}</small></span>, `${placementNames[row.placement] ?? row.placement} · ${Number(row.position) + 1}`, deviceName(row.device), row.impressions, row.clicks, percent(row.clicks, row.impressions),
        measuredFeatures.has(row.entry) ? row.usedAfterClick : '—', measuredFeatures.has(row.entry) ? percent(row.usedAfterClick, row.clicks) : '—'] }));
  } else {
    headers = [t('功能', 'Feature'), t('使用账号', 'Using accounts'), t('人均活跃天数', 'Active days per account'), t('人均使用会话', 'Using sessions per account')];
    rows = data.frequency.map(row => ({ key: row.feature, volume: row.users, rate: row.activeDaysPerUser,
      cells: [featureName(row.feature), row.users, row.activeDaysPerUser.toFixed(2), row.sessionsPerUser.toFixed(2)] }));
  }
  rows.sort((a, b) => (sort === 'rate' ? b.rate - a.rate : b.volume - a.volume) || a.key.localeCompare(b.key));
  const last = Math.max(0, Math.ceil(rows.length / 50) - 1);
  const current = Math.min(page, last);
  if (!rows.length) return <p className="admin-dashboard__empty">{view === 'frequency' ? t('没有可计算频率的登录账号操作。', 'No signed-in feature activity to calculate frequency.') : t('此视图暂无数据。', 'No data in this view.')}</p>;
  return <div className="admin-dashboard__table">
    <div className="admin-dashboard__toolbar"><CompactSelect value={sort} onChange={value => { setSort(value); setPage(0); }} label={sort === 'volume' ? t('按数量排序', 'Sort by volume') : t('按比例 / 频率排序', 'Sort by rate / frequency')} ariaLabel={t('排序', 'Sort')} items={[
      { value: 'volume', label: view === 'entries' ? t('曝光量优先', 'Most impressions') : view === 'pages' ? t('访问量优先', 'Most views') : t('使用人数优先', 'Most accounts') },
      { value: 'rate', label: view === 'entries' ? t('点击率优先', 'Highest CTR') : view === 'pages' ? t('使用率优先', 'Highest usage rate') : t('活跃天数优先', 'Most active days') },
    ]} /></div>
    <div className="sticky-scroll product-analytics__scroll"><table className="sticky-thead"><thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
      <tbody>{rows.slice(current * 50, (current + 1) * 50).map(row => <tr key={row.key}>{row.cells.map((value, index) => index === 0 ? <th key={index} scope="row">{value}</th> : <td key={index}>{typeof value === 'number' ? value.toLocaleString() : value}</td>)}</tr>)}</tbody></table></div>
    {last > 0 && <div className="product-analytics__pagination"><button type="button" className="admin-boot__refresh" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('上一页', 'Previous')}</button>
      <span>{current + 1} / {last + 1}</span><button type="button" className="admin-boot__refresh" disabled={current === last} onClick={() => setPage(current + 1)}>{t('下一页', 'Next')}</button></div>}
  </div>;
}
