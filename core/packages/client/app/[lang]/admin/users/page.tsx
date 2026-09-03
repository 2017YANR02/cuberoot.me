'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryState, useQueryStates } from 'nuqs';
import { ChevronLeft, ChevronRight, Loader2, Monitor, Search, Smartphone, Tablet } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { CompactSelect } from '@/components/CompactSelect';
import { DailyActivityChart, type DailyActivityPoint } from '@/components/DailyActivityChart';
import { DateRangeInput } from '@/components/DateRangeInput';
import { Flag } from '@/components/Flag';
import SortArrow from '@/components/SortArrow';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { hasAdminAccess, useAuthStore } from '@/lib/auth-store';
import { countryName } from '@/lib/country-name';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fetchAdminUsers, updateAdminRole, type AdminUserRecord, type AdminUsersResponse } from '@/lib/account-api';
import { isValidIsoDate } from '@/lib/iso-date';
import './users.css';

const PROVIDERS = ['all', 'email', 'phone', 'wca', 'google', 'wechat', 'douyin', 'qq', 'alipay', 'apple', 'password', 'none'] as const;
type ProviderFilter = typeof PROVIDERS[number];
type SortKey = 'created' | 'name' | 'id';
type SortDirection = 'asc' | 'desc';
const PAGE_SIZE = 25;
const RANGE_PRESETS = [7, 30, 90, 365] as const;
type AdminUsersError = 'load' | 'both_dates' | 'invalid_date' | 'date_order' | 'future_date' | 'range_too_long';

function rangeFromDays(days: number, to: string): string {
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return new Date(end - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function activityRangeError(from: string, to: string, today: string): AdminUsersError | null {
  if (!from && !to) return null;
  if (!from || !to) return 'both_dates';
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return 'invalid_date';
  if (from > to) return 'date_order';
  if (to > today) return 'future_date';
  const days = Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000) + 1;
  return days > 366 ? 'range_too_long' : null;
}

function errorLabel(error: AdminUsersError, t: ReturnType<typeof useT>): string {
  const labels: Record<AdminUsersError, [string, string]> = {
    load: ['用户数据加载失败，请稍后重试。', 'Could not load user data. Try again later.'],
    both_dates: ['请选择完整的开始和结束日期。', 'Choose both a start and end date.'],
    invalid_date: ['日期格式无效。', 'The date is invalid.'],
    date_order: ['开始日期不能晚于结束日期。', 'The start date cannot be after the end date.'],
    future_date: ['日期范围不能包含未来日期。', 'The date range cannot include future dates.'],
    range_too_long: ['一次最多查看 366 天。', 'You can view at most 366 days at a time.'],
  };
  return t(labels[error][0], labels[error][1]);
}

function providerLabel(provider: string, t: ReturnType<typeof useT>): string {
  const labels: Record<string, [string, string]> = {
    all: ['全部绑定', 'All methods'],
    email: ['邮箱', 'Email'],
    phone: ['手机', 'Phone'],
    wca: ['WCA', 'WCA'],
    google: ['Google', 'Google'],
    wechat: ['微信', 'WeChat'],
    douyin: ['抖音', 'Douyin'],
    qq: ['QQ', 'QQ'],
    alipay: ['支付宝', 'Alipay'],
    apple: ['Apple', 'Apple'],
    password: ['密码', 'Password'],
    none: ['无可用登录方式', 'No sign-in method'],
  };
  const label = labels[provider];
  return label ? t(label[0], label[1]) : provider;
}

function genderLabel(gender: string | null, t: ReturnType<typeof useT>): string {
  const labels: Record<string, [string, string]> = {
    male: ['男', 'Male'], female: ['女', 'Female'], nonbinary: ['非二元', 'Non-binary'],
    other: ['其他', 'Other'], undisclosed: ['不公开', 'Prefer not to say'],
  };
  const label = gender ? labels[gender] : undefined;
  return label ? t(label[0], label[1]) : '—';
}

function formatTimestamp(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function identityValue(identity: AdminUserRecord['identities'][number]): string {
  if (identity.provider === 'email' || identity.provider === 'phone' || identity.provider === 'wca') {
    return identity.providerUid;
  }
  return identity.providerUid.length <= 24 ? identity.providerUid : `${identity.providerUid.slice(0, 10)}…${identity.providerUid.slice(-6)}`;
}

function deviceTypeLabel(deviceType: NonNullable<AdminUserRecord['lastDevice']>['deviceType'], t: ReturnType<typeof useT>): string {
  const labels = {
    phone: ['手机', 'Phone'], tablet: ['平板', 'Tablet'], desktop: ['电脑', 'Computer'], other: ['其他设备', 'Other device'],
  } as const;
  return t(labels[deviceType][0], labels[deviceType][1]);
}

function osLabel(device: NonNullable<AdminUserRecord['lastDevice']>, t: ReturnType<typeof useT>): string {
  const labels = {
    android: 'Android', ios: 'iOS', windows: 'Windows', macos: 'macOS', linux: 'Linux', other: t('未知系统', 'Unknown OS'),
  } as const;
  const showMajor = device.osMajor !== null && (device.osFamily === 'android' || device.osFamily === 'ios' || device.osFamily === 'macos');
  return `${labels[device.osFamily]}${showMajor ? ` ${device.osMajor}` : ''}`;
}

function browserLabel(device: NonNullable<AdminUserRecord['lastDevice']>, t: ReturnType<typeof useT>): string {
  const labels = {
    chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', safari: 'Safari',
    wechat: t('微信内置浏览器', 'WeChat browser'), webview: 'WebView', other: t('未知浏览器', 'Unknown browser'),
  } as const;
  return `${labels[device.browserFamily]}${device.browserMajor !== null ? ` ${device.browserMajor}` : ''}`;
}

function DeviceIcon({ deviceType }: { deviceType: NonNullable<AdminUserRecord['lastDevice']>['deviceType'] }) {
  if (deviceType === 'phone') return <Smartphone size={16} aria-hidden />;
  if (deviceType === 'tablet') return <Tablet size={16} aria-hidden />;
  return <Monitor size={16} aria-hidden />;
}

export default function AdminUsersPage() {
  const t = useT();
  const lang = useLang();
  const isZh = lang !== 'en';
  const locale = isZh ? 'zh-CN' : 'en-US';
  const user = useAuthStore((state) => state.user);
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [error, setError] = useState<AdminUsersError | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [q, setQ] = useQueryState('q', parseAsString.withDefault(''));
  const [provider, setProvider] = useQueryState(
    'provider', parseAsStringEnum<ProviderFilter>([...PROVIDERS]).withDefault('all'),
  );
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [sort, setSort] = useQueryState(
    'sort', parseAsStringEnum<SortKey>(['created', 'name', 'id']).withDefault('created'),
  );
  const [direction, setDirection] = useQueryState(
    'direction', parseAsStringEnum<SortDirection>(['asc', 'desc']).withDefault('desc'),
  );
  const [{ from, to }, setRange] = useQueryStates({
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
  });
  const [queryDraft, setQueryDraft] = useState(q);
  const rangeProblem = activityRangeError(from, to, today);

  const isAdmin = hasAdminAccess(user);
  useEffect(() => setMounted(true), []);
  useEffect(() => setQueryDraft(q), [q]);

  useEffect(() => {
    if (!mounted || !isAdmin) return;
    if (page < 1) {
      void setPage(1);
      return;
    }
    if (rangeProblem) {
      setError(rangeProblem);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAdminUsers({
      q, provider, page, pageSize: PAGE_SIZE, sort, direction,
      from: from || undefined,
      to: to || undefined,
    })
      .then((result) => {
        if (cancelled) return;
        const lastPage = Math.max(1, Math.ceil(result.pagination.total / PAGE_SIZE));
        if (page > lastPage) {
          void setPage(lastPage);
          return;
        }
        setData(result);
      })
      .catch(() => { if (!cancelled) setError('load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [direction, from, isAdmin, mounted, page, provider, q, rangeProblem, sort, to]);

  const registrationPoints = useMemo<DailyActivityPoint[]>(() => (
    (data?.activity?.registrations ?? data?.daily ?? []).map((item) => ({ date: item.date, values: { registrations: item.count } }))
  ), [data?.activity?.registrations, data?.daily]);
  const membershipPoints = useMemo<DailyActivityPoint[]>(() => (
    data?.activity?.memberships.map((item) => ({
      date: item.date,
      values: { personal: item.personal, enterprise: item.enterprise },
    })) ?? []
  ), [data?.activity?.memberships]);
  const totalPages = Math.max(1, Math.ceil((data?.pagination.total ?? 0) / PAGE_SIZE));
  const legacyFrom = data?.daily.at(0)?.date ?? '';
  const legacyTo = data?.daily.at(-1)?.date ?? '';
  const effectiveFrom = from || data?.activity?.from || legacyFrom;
  const effectiveTo = to || data?.activity?.to || legacyTo;
  const activePreset = RANGE_PRESETS.find((days) => effectiveTo === today && effectiveFrom === rangeFromDays(days, today));

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    void Promise.all([setQ(queryDraft.trim() || null), setPage(null)]);
  };
  const changeSort = (next: SortKey) => {
    if (sort === next) void setDirection(direction === 'asc' ? 'desc' : 'asc');
    else void Promise.all([setSort(next), setDirection(next === 'name' ? 'asc' : 'desc')]);
    void setPage(null);
  };
  const changeRange = (nextFrom: string, nextTo: string) => {
    void setRange({ from: nextFrom || null, to: nextTo || null });
  };
  const selectPreset = (days: number) => changeRange(rangeFromDays(days, today), today);
  const changeAdminRole = async (record: AdminUserRecord, nextIsAdmin: boolean) => {
    const name = record.displayName || `UID ${record.id}`;
    const confirmed = window.confirm(nextIsAdmin
      ? t(`确认将“${name}”设为管理员吗？管理员可以查看用户资料并使用所有后台工具。`, `Make “${name}” an administrator? Administrators can view user data and use all administration tools.`)
      : t(`确认取消“${name}”的管理员权限吗？更改会立即生效。`, `Remove administrator access from “${name}”? The change takes effect immediately.`));
    if (!confirmed) return;

    setRoleUpdatingId(record.id);
    setRoleError(null);
    try {
      const updated = await updateAdminRole(record.id, nextIsAdmin);
      setData((current) => current ? {
        ...current,
        users: current.users.map((item) => item.id === record.id ? {
          ...item,
          isAdmin: updated.isAdmin,
          isRootAdmin: updated.isRootAdmin,
        } : item),
      } : current);
    } catch {
      setRoleError(t('管理员权限更新失败，请稍后重试。', 'Could not update administrator access. Try again later.'));
    } finally {
      setRoleUpdatingId(null);
    }
  };

  if (!mounted) return <main className="admin-users-page" />;
  if (!isAdmin) {
    return (
      <main className="admin-users-page">
        <AppLink href="/admin" className="admin-users-back" prefetch={false}><ChevronLeft size={16} />{t('管理后台', 'Administration')}</AppLink>
        <h1>{t('用户与增长', 'Users and growth')}</h1>
        <p className="admin-users-status">{t('只有管理员可以查看注册用户资料。', 'Only administrators can view registered user data.')}</p>
      </main>
    );
  }

  return (
    <main className="admin-users-page">
      <AppLink href="/admin" className="admin-users-back" prefetch={false}><ChevronLeft size={16} />{t('管理后台', 'Administration')}</AppLink>
      <header className="admin-users-heading">
        <div>
          <h1>{t('用户、增长与权限', 'Users, growth, and access')}</h1>
          <p>{t('查看注册与会员增长、账号资料，并管理后台访问权限。', 'Review registration and membership growth, account data, and administration access.')}</p>
        </div>
        {loading && <Loader2 size={18} className="admin-users-spin" aria-label={t('正在刷新', 'Refreshing')} />}
      </header>

      {error && <p className="admin-users-error" role="alert">{errorLabel(error, t)}</p>}
      {roleError && <p className="admin-users-error" role="alert">{roleError}</p>}

      {data && (
        <>
          <section aria-labelledby="admin-users-overview-title">
            <h2 id="admin-users-overview-title">{t('总览', 'Overview')}</h2>
            <dl className="admin-users-metrics">
              <div><dt>{t('注册用户', 'Registered users')}</dt><dd>{data.summary.totalUsers}</dd></div>
              <div><dt>{t('今日新增', 'New today')}</dt><dd>{data.summary.registeredToday}</dd></div>
              <div><dt>{t('近 7 日新增', 'New in 7 days')}</dt><dd>{data.summary.registeredLast7Days}</dd></div>
              <div><dt>{t('个人会员', 'Individual members')}</dt><dd>{data.membershipSummary?.activePersonal ?? '—'}</dd></div>
              <div><dt>{t('企业会员', 'Enterprise members')}</dt><dd>{data.membershipSummary?.activeEnterprise ?? '—'}</dd></div>
              <div><dt>{t('已绑定 WCA', 'WCA linked')}</dt><dd>{data.summary.wcaUsers}</dd></div>
              <div><dt>{t('已设置密码', 'Password set')}</dt><dd>{data.summary.passwordUsers}</dd></div>
              <div><dt>{t('基本资料完整', 'Profile complete')}</dt><dd>{data.summary.completedProfiles}</dd></div>
            </dl>
          </section>

          <section className="admin-users-activity" aria-labelledby="admin-users-activity-title">
            <div className="admin-users-activity-heading">
              <div>
                <h2 id="admin-users-activity-title">{t('增长趋势', 'Growth trends')}</h2>
                <p>{t('选择日期范围后，注册与会员图表会一起更新。', 'Choose a date range to update both registration and membership charts.')}</p>
              </div>
              <span>{t('UTC 自然日', 'UTC calendar days')}</span>
            </div>
            {!data.activity && (
              <p className="admin-users-compat-notice" role="status">
                {t('本地前端当前连接的是旧版统计接口，会员总数和会员趋势会在新接口运行后自动显示。', 'This local frontend is connected to the previous statistics API. Membership totals and trends appear automatically when the new API is running.')}
              </p>
            )}
            <div className="admin-users-range-toolbar">
              <CompactSelect<number>
                items={RANGE_PRESETS.map((days) => ({ value: days, label: t(`${days} 天`, `${days} days`) }))}
                value={activePreset}
                onChange={selectPreset}
                label={activePreset ? t(`${activePreset} 天`, `${activePreset} days`) : t('自定义', 'Custom')}
                valueText={activePreset ? t(`${activePreset} 天`, `${activePreset} days`) : t('自定义', 'Custom')}
                ariaLabel={t('快捷日期范围', 'Quick date ranges')}
              />
              <DateRangeInput
                from={effectiveFrom}
                to={effectiveTo}
                onChange={changeRange}
                max={today}
                size="compact"
                clearable={false}
                ariaLabel={t('增长统计日期范围', 'Growth statistics date range')}
              />
            </div>

            <div className="admin-users-chart-block">
              <div className="admin-users-chart-title">
                <h3>{t('每日注册', 'Daily registrations')}</h3>
                <span>{effectiveFrom} ~ {effectiveTo}</span>
              </div>
              <DailyActivityChart
                data={registrationPoints}
                from={effectiveFrom}
                to={effectiveTo}
                series={[{ key: 'registrations', label: t('注册', 'Registrations'), tone: 'accent' }]}
                ariaLabel={t('每日注册柱形图', 'Daily registration bar chart')}
                emptyLabel={t('所选日期范围没有注册数据。', 'No registration data in this date range.')}
              />
            </div>

            {data.activity && (
              <div className="admin-users-chart-block">
                <div className="admin-users-chart-title">
                  <h3>{t('每日新增会员', 'Daily new memberships')}</h3>
                  <span>{t('首次加入，续费不重复计算', 'First joins only; renewals excluded')}</span>
                </div>
                <DailyActivityChart
                  data={membershipPoints}
                  from={effectiveFrom}
                  to={effectiveTo}
                  series={[
                    { key: 'personal', label: t('个人会员', 'Individual'), tone: 'success' },
                    { key: 'enterprise', label: t('企业会员', 'Enterprise'), tone: 'info' },
                  ]}
                  ariaLabel={t('每日新增个人和企业会员柱形图', 'Daily new individual and enterprise membership bar chart')}
                  emptyLabel={t('所选日期范围没有会员数据。', 'No membership data in this date range.')}
                />
              </div>
            )}
          </section>

          <section aria-labelledby="admin-users-bindings-title">
            <h2 id="admin-users-bindings-title">{t('登录绑定', 'Linked sign-in methods')}</h2>
            <ul className="admin-users-bindings">
              {data.providerCounts.map((item) => <li key={item.provider}><span>{providerLabel(item.provider, t)}</span><strong>{item.count}</strong></li>)}
              <li><span>{t('密码', 'Password')}</span><strong>{data.summary.passwordUsers}</strong></li>
              {data.summary.usersWithoutIdentity > 0 && <li><span>{t('无可用登录方式', 'No sign-in method')}</span><strong>{data.summary.usersWithoutIdentity}</strong></li>}
            </ul>
          </section>

          <section aria-labelledby="admin-users-list-title">
            <div className="admin-users-list-heading">
              <h2 id="admin-users-list-title">{t('用户明细', 'User records')}</h2>
              <span>{t(`共 ${data.pagination.total} 人`, `${data.pagination.total} users`)}</span>
            </div>
            <form className="admin-users-filters" onSubmit={submitSearch}>
              <div className="admin-users-search">
                <Search size={15} aria-hidden />
                <input className="admin-users-search-input" value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} maxLength={100}
                  placeholder={t('搜索用户名、ID、邮箱、手机或 WCA ID', 'Search name, ID, email, phone, or WCA ID')}
                  aria-label={t('搜索用户', 'Search users')} />
                {queryDraft && <ClearButton onClick={() => { setQueryDraft(''); void Promise.all([setQ(null), setPage(null)]); }} preserveFocus />}
              </div>
              <button type="submit" className="admin-users-submit">{t('搜索', 'Search')}</button>
              <select className="admin-users-filter-select" value={provider} onChange={(event) => { void setProvider(event.target.value as ProviderFilter); void setPage(null); }}
                aria-label={t('按登录方式筛选', 'Filter by sign-in method')}>
                {PROVIDERS.map((item) => (
                  <option key={item} value={item}>
                    {providerLabel(item, t)}
                  </option>
                ))}
              </select>
            </form>

            <p className="admin-users-table-hint">{t('左右滑动查看完整表格', 'Swipe horizontally to view the full table')}</p>
            <div className="sticky-scroll admin-users-table-scroll">
              <table className="sticky-thead admin-users-table">
                <thead><tr>
                  <th><button className="admin-users-sort" type="button" onClick={() => changeSort('name')}>{t('用户名', 'Username')}<SortArrow active={sort === 'name'} dir={direction} /></button></th>
                  <th>{t('绑定', 'Linked methods')}</th>
                  <th>{t('最近使用设备', 'Latest device')}</th>
                  <th>{t('资料', 'Profile')}</th>
                  <th>{t('权限', 'Access')}</th>
                  <th><button className="admin-users-sort" type="button" onClick={() => changeSort('created')}>{t('注册时间', 'Registered')}<SortArrow active={sort === 'created'} dir={direction} /></button></th>
                </tr></thead>
                <tbody>
                  {data.users.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <AppLink href={`/account?view=user&user=${record.id}`} prefetch={false} className="admin-users-name">
                          {record.countryIso2 && <Flag iso2={record.countryIso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                          {record.wcaId ? displayCuberName(record.displayName, isZh) : record.displayName || t('未命名', 'Unnamed')}
                        </AppLink>
                        <span className="admin-users-id">UID {record.id}{record.wcaId ? ` / ${record.wcaId}` : ''}</span>
                      </td>
                      <td><div className="admin-users-methods">
                        {record.identities.map((identity) => <span key={`${identity.provider}:${identity.providerUid}`} title={identityValue(identity)}>{providerLabel(identity.provider, t)}</span>)}
                        {record.hasPassword && <span>{t('密码', 'Password')}</span>}
                        {!record.hasPassword && record.identities.length === 0 && <span>{t('无', 'None')}</span>}
                      </div></td>
                      <td>
                        {record.lastDevice ? (
                          <div className="admin-users-device">
                            <DeviceIcon deviceType={record.lastDevice.deviceType} />
                            <span>
                              <strong>{deviceTypeLabel(record.lastDevice.deviceType, t)}：{osLabel(record.lastDevice, t)}</strong>
                              <small>{browserLabel(record.lastDevice, t)} {formatTimestamp(record.lastDevice.lastSeenAt, locale)}</small>
                            </span>
                          </div>
                        ) : <span className="admin-users-device-empty">{t('尚未记录', 'Not recorded yet')}</span>}
                      </td>
                      <td>
                        <details className="admin-users-details">
                          <summary>{t('查看', 'View')}</summary>
                          <dl>
                            <div><dt>{t('原始用户名', 'Stored username')}</dt><dd>{record.displayName || '—'}</dd></div>
                            <div><dt>{t('出生日期', 'Date of birth')}</dt><dd>{record.birthDate || '—'}</dd></div>
                            <div><dt>{t('性别', 'Gender')}</dt><dd>{genderLabel(record.gender, t)}</dd></div>
                            <div>
                              <dt>{t('国家或地区', 'Country or region')}</dt>
                              <dd>
                                {record.countryIso2 ? (
                                  <><Flag iso2={record.countryIso2} spanClassName="country-flag" imgClassName="country-flag-ct" />{' '}{countryName(record.countryIso2, isZh)}</>
                                ) : '—'}
                              </dd>
                            </div>
                            <div><dt>{t('地区和城市', 'Region and city')}</dt><dd>{[record.regionCode, record.cityName].filter(Boolean).join(' / ') || '—'}</dd></div>
                            <div><dt>{t('界面语言', 'Interface language')}</dt><dd>{record.lang || '—'}</dd></div>
                            <div><dt>{t('邮件通知', 'Email notifications')}</dt><dd>{record.emailNotify ? t('开启', 'On') : t('关闭', 'Off')}</dd></div>
                            <div><dt>{t('资料更新时间', 'Profile updated')}</dt><dd>{formatTimestamp(record.updatedAt, locale)}</dd></div>
                            {record.identities.map((identity) => (
                              <div key={`${identity.provider}:${identity.providerUid}:detail`}>
                                <dt>{providerLabel(identity.provider, t)}</dt><dd>{identityValue(identity)}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      </td>
                      <td>
                        <div className="admin-users-role">
                          <span>{record.isRootAdmin ? t('站主管理员', 'Site owner') : record.isAdmin ? t('管理员', 'Administrator') : t('普通用户', 'User')}</span>
                          {!record.isRootAdmin && (
                            <button
                              className="admin-users-page-button admin-users-role-button"
                              type="button"
                              disabled={roleUpdatingId !== null}
                              onClick={() => void changeAdminRole(record, !record.isAdmin)}
                            >
                              {roleUpdatingId === record.id
                                ? t('处理中…', 'Updating…')
                                : record.isAdmin ? t('取消管理员', 'Remove admin') : t('设为管理员', 'Make admin')}
                            </button>
                          )}
                        </div>
                      </td>
                      <td><time dateTime={record.createdAt}>{formatTimestamp(record.createdAt, locale)}</time></td>
                    </tr>
                  ))}
                  {data.users.length === 0 && <tr><td colSpan={6} className="admin-users-empty">{t('没有符合条件的用户。', 'No users match these filters.')}</td></tr>}
                </tbody>
              </table>
            </div>

            <nav className="admin-users-pagination" aria-label={t('用户列表分页', 'User list pagination')}>
              <button className="admin-users-page-button" type="button" disabled={page <= 1} onClick={() => void setPage(Math.max(1, page - 1))}><ChevronLeft size={15} />{t('上一页', 'Previous')}</button>
              <span>{t(`第 ${page} / ${totalPages} 页`, `Page ${page} of ${totalPages}`)}</span>
              <button className="admin-users-page-button" type="button" disabled={page >= totalPages} onClick={() => void setPage(Math.min(totalPages, page + 1))}>{t('下一页', 'Next')}<ChevronRight size={15} /></button>
            </nav>
          </section>
        </>
      )}

      {!data && !error && <p className="admin-users-status"><Loader2 size={16} className="admin-users-spin" />{t('正在加载用户数据…', 'Loading user data…')}</p>}
    </main>
  );
}
